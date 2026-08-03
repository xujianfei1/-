/**
 * 单元测试: middleware 子域识别
 * 注意: 这是纯函数, 不实际启动 next 运行时
 */
import { describe, it, expect } from 'vitest';

// 重现 middleware 里的识别逻辑 (不直接 import middleware, 避免 next-runtime 依赖)
const PERIOD_PREFIX = 'period.';
const PASS_THROUGH_PREFIXES = ['/api/', '/_next/', '/signin', '/signout', '/favicon'] as const;

// 与 middleware 同步: 先 toLowerCase + 剥端口
function normalize(rawHost: string | null): string {
  if (!rawHost) return '';
  return rawHost.toLowerCase().split(':')[0] ?? '';
}

function isPeriodSubdomain(host: string): boolean {
  return host.startsWith(PERIOD_PREFIX) && host.length > PERIOD_PREFIX.length;
}

function shouldPassThrough(pathname: string): boolean {
  return PASS_THROUGH_PREFIXES.some((p) => pathname.startsWith(p));
}

function checkPeriod(rawHost: string | null): boolean {
  const host = normalize(rawHost);
  if (!host) return false;
  return isPeriodSubdomain(host);
}

describe('middleware: subdomain 识别', () => {
  it('生产子域识别为 period', () => {
    expect(checkPeriod('period.xujianfei.cn')).toBe(true);
    expect(checkPeriod('period.xujianfei.cn:443')).toBe(true);
    expect(checkPeriod('PERIOD.xujianfei.cn')).toBe(true);
  });

  it('开发期模拟子域也识别', () => {
    expect(checkPeriod('period.localhost')).toBe(true);
    expect(checkPeriod('period.test')).toBe(true);
    expect(checkPeriod('period.localhost:3000')).toBe(true);
  });

  it('主域 / 同域 / IP / 其它子域都识别为非 period', () => {
    expect(checkPeriod('me.xujianfei.cn')).toBe(false);
    expect(checkPeriod('xujianfei.cn')).toBe(false);
    expect(checkPeriod('price.xujianfei.cn')).toBe(false);
    expect(checkPeriod('blog.xujianfei.cn')).toBe(false);
    expect(checkPeriod('localhost')).toBe(false);
    expect(checkPeriod('127.0.0.1')).toBe(false);
    expect(checkPeriod('10.29.23.170:3000')).toBe(false);
  });

  it('null / undefined / 空 → false', () => {
    expect(checkPeriod(null)).toBe(false);
    expect(checkPeriod(undefined as unknown as string)).toBe(false);
    expect(checkPeriod('')).toBe(false);
  });

  it('防误伤: "myperiod.xujianfei.cn" 不应被识别', () => {
    expect(checkPeriod('myperiod.xujianfei.cn')).toBe(false);
  });
});

describe('middleware: 白名单路径放行', () => {
  it('API 路由放行', () => {
    expect(shouldPassThrough('/api/period/cycles')).toBe(true);
    expect(shouldPassThrough('/api/auth/session')).toBe(true);
  });

  it('静态资源放行', () => {
    expect(shouldPassThrough('/_next/static/chunks/main-app.js')).toBe(true);
    expect(shouldPassThrough('/favicon.ico')).toBe(true);
  });

  it('登录页放行', () => {
    expect(shouldPassThrough('/signin')).toBe(true);
    expect(shouldPassThrough('/signout')).toBe(true);
  });

  it('业务路径不被放行 (应被改写)', () => {
    expect(shouldPassThrough('/')).toBe(false);
    expect(shouldPassThrough('/cycles')).toBe(false);
    expect(shouldPassThrough('/period')).toBe(false);
  });
});
