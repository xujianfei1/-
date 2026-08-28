/**
 * 子域名路由改写 + 安全 header + 登录限流
 *
 * 1. 子域名路由改写
 *    period.xujianfei.cn       → /period     (经期预测)
 *    pan.xujianfei.cn          → /pan        (云盘)
 *    xujianfei.cn (主域)        → 正常路由    (个人门户)
 *    localhost / IP            → 正常路由
 *
 * 2. 登录限流: POST /api/auth/callback/credentials 限 15 次 / 15 分钟 / IP
 *    超限返 429 + Retry-After.
 *
 * 3. 安全 header (所有响应):
 *    - Strict-Transport-Security: 强制 HTTPS 1 年
 *    - X-Frame-Options: 默认 DENY (防点击劫持; 比 SAMEORIGIN 更严). 预览 API 例外 → SAMEORIGIN
 *    - X-Content-Type-Options: nosniff
 *    - Referrer-Policy: strict-origin-when-cross-origin
 *    - Permissions-Policy: 关掉不需要的硬件/特性 API
 *    - Content-Security-Policy: 保守配置 (允许 'unsafe-inline' for Next.js 注入脚本). frame-ancestors 预览 API 例外 → 'self'
 *    - Cross-Origin-Opener-Policy: same-origin (防侧信道)
 *
 * 例外:
 *   /api/*                    全部放行, API 路由由 Next.js 自己处理
 *   /_next/*                  静态资源放行
 *   /favicon.ico              放行
 *   /signin /signout          放行 (登录态走共享 cookie, 不需要改写)
 *
 * 开发期模拟:
 *   Windows: 在 C:\Windows\System32\drivers\etc\hosts 加
 *       127.0.0.1  me.test
 *       127.0.0.1  period.test
 *       127.0.0.1  pan.test
 *   然后访问 http://pan.test:3000 即可
 */
import { NextResponse, type NextRequest } from 'next/server';
import { check, getClientIp } from '@/lib/rate-limit';

const PERIOD_PREFIX = 'period.';
const PAN_PREFIX = 'pan.';
const PASS_THROUGH_PREFIXES = ['/api/', '/_next/', '/signin', '/signout', '/favicon'] as const;

/** 形如 period.xujianfei.cn / period.localhost / period.test 都算 */
function isPeriodSubdomain(host: string): boolean {
  return host.startsWith(PERIOD_PREFIX) && host.length > PERIOD_PREFIX.length;
}

function isPanSubdomain(host: string): boolean {
  return host.startsWith(PAN_PREFIX) && host.length > PAN_PREFIX.length;
}

/** 预览 API 路径: 允许同源 iframe 嵌入 (PDF 在浏览器内置 viewer 里渲染需要) */
function isPreviewPath(pathname: string): boolean {
  if (pathname.startsWith('/api/pan/preview/')) return true;
  if (/^\/api\/pan\/public-share\/[^/]+\/preview\/?$/.test(pathname)) return true;
  return false;
}

/** 给响应追加安全 header (CSP 谨慎配, 兼容 Next.js inline 脚本) */
function applySecurityHeaders(res: NextResponse, pathname: string): NextResponse {
  // HSTS: 1 年 + 子域. 注意: 一旦下发浏览器会强制 HTTPS, 测试环境慎用 (用 max-age=300 可短测试)
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // 预览 API 需要被同源 iframe 嵌入, 其他页面维持 DENY 防点击劫持
  if (isPreviewPath(pathname)) {
    res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  } else {
    res.headers.set('X-Frame-Options', 'DENY');
  }
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(), usb=()');
  // CSP: 保守配, frame-ancestors 防嵌入, base-uri 防 base 标签劫持, form-action 限制表单提交目标
  // 不限 script-src 'unsafe-inline' (Next.js dev/prod 都需要)
  // 不限 style-src 'unsafe-inline' (Tailwind 注入 + CSS-in-JS)
  // 预览 API 允许同源嵌入, 其他路径严格禁嵌入
  const frameAncestors = isPreviewPath(pathname) ? "'self'" : "'none'";
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://xujianfei-pan-001.oss-cn-hangzhou.aliyuncs.com",
      `frame-ancestors ${frameAncestors}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  return res;
}

export function middleware(req: NextRequest) {
  // ========== 登录限流 (在所有路由前) ==========
  if (
    req.method === 'POST' &&
    req.nextUrl.pathname === '/api/auth/callback/credentials'
  ) {
    const ip = getClientIp(req);
    const r = check(`login:${ip}`, 15, 15 * 60 * 1000); // 15 次 / 15min / IP
    if (!r.ok) {
      const res = new NextResponse(
        JSON.stringify({ error: `登录尝试过多, 请 ${Math.ceil(r.retryAfterSec / 60)} 分钟后再试` }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': r.retryAfterSec.toString(),
            'X-RateLimit-Limit': r.limit.toString(),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
      return applySecurityHeaders(res, req.nextUrl.pathname);
    }
  }

  // ========== API 限流 (防刷下载流量 / 防恶意开 upload session / 防刷分享创建) ==========
  // 配额设计: 上传 60/h (一个 session 至少 15MB+3 part, 60 个 session 约 1GB 上传);
  //          下载 200/h (单 IP 200 文件/h 远超日常用量);
  //          公开下载 200/h (防单 IP 滥用别人 token);
  //          分享创建 60/h (单用户不会频繁创建分享).
  const apiRateLimit = (() => {
    const m = req.method;
    const p = req.nextUrl.pathname;
    if (m === 'POST' && /^\/api\/pan\/upload(\/|$)/.test(p))
      return { name: 'upload', limit: 60, windowMs: 60 * 60 * 1000 };
    if (m === 'GET' && /^\/api\/pan\/download\//.test(p))
      return { name: 'download', limit: 200, windowMs: 60 * 60 * 1000 };
    if (m === 'POST' && p === '/api/pan/share')
      return { name: 'share-create', limit: 60, windowMs: 60 * 60 * 1000 };
    if (m === 'GET' && /^\/api\/pan\/public-share\/[^/]+\/download$/.test(p))
      return { name: 'public-download', limit: 200, windowMs: 60 * 60 * 1000 };
    if (m === 'POST' && p === '/api/auth/forgot-password')
      return { name: 'forgot-password', limit: 5, windowMs: 60 * 60 * 1000 };
    if (m === 'POST' && p === '/api/auth/reset-password')
      return { name: 'reset-password', limit: 10, windowMs: 60 * 60 * 1000 };
    return null;
  })();
  if (apiRateLimit) {
    const ip = getClientIp(req);
    const r = check(`api:${apiRateLimit.name}:${ip}`, apiRateLimit.limit, apiRateLimit.windowMs);
    if (!r.ok) {
      const res = new NextResponse(
        JSON.stringify({ error: `请求过于频繁 (${apiRateLimit.name}), 请 ${Math.ceil(r.retryAfterSec / 60)} 分钟后再试` }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Retry-After': r.retryAfterSec.toString(),
            'X-RateLimit-Limit': r.limit.toString(),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
      return applySecurityHeaders(res, req.nextUrl.pathname);
    }
  }

  // ========== API 早鉴权 (防 405 暴露路由存在性) ==========
  // pan API (除 public-share) 必须登录: 查 cookie 存在性 (edge runtime 不能用 Prisma).
  // ban 校验交给 route handler 里的 requireActiveUser() 兜底.
  if (req.nextUrl.pathname.startsWith('/api/pan/') &&
      !req.nextUrl.pathname.startsWith('/api/pan/public-share/')) {
    // NextAuth v5 的 cookie 前缀是 authjs. (v4 才是 next-auth.)
    const c = req.cookies.get('__Secure-authjs.session-token')
           ?? req.cookies.get('authjs.session-token');
    if (!c) {
      const res = new NextResponse(
        JSON.stringify({ error: '未登录' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'WWW-Authenticate': 'Cookie realm="pan"',
          },
        },
      );
      return applySecurityHeaders(res, req.nextUrl.pathname);
    }
  }

  // ========== 子域改写 ==========
  const rawHost = req.headers.get('host') ?? '';
  const host: string = rawHost.toLowerCase().split(':')[0] ?? '';
  const { pathname } = req.nextUrl;

  if (!isPeriodSubdomain(host) && !isPanSubdomain(host)) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  if (PASS_THROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return applySecurityHeaders(NextResponse.next(), pathname);
  }

  // 标记来源子域, 供页面读
  const target = isPanSubdomain(host) ? '/pan' : '/period';
  const res = NextResponse.rewrite(new URL(target, req.url));
  res.headers.set('x-portal-host', host);
  return applySecurityHeaders(res, pathname);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};