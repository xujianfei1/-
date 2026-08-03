/**
 * 内存限流器 (Edge runtime 兼容)
 *
 * 用法:
 *   const r = check('login:1.2.3.4', 15, 15 * 60 * 1000); // 15 次 / 15 分钟
 *   if (!r.ok) return new Response('Too many requests', { status: 429, headers: { 'Retry-After': ... } });
 *
 * 多实例不共享 (无集群同步). 够单实例用.
 *
 * 内存控制: 过期 entry 自动清理 (5min 一次). setInterval + .unref() 避免阻塞进程退出.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

declare global {
  // 避免 HMR 重载时重复启动 interval
  // eslint-disable-next-line no-var
  var __rateLimitCleanup: ReturnType<typeof setInterval> | undefined;
}

if (!globalThis.__rateLimitCleanup) {
  globalThis.__rateLimitCleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }, CLEANUP_INTERVAL_MS);
  // 不阻止进程退出
  globalThis.__rateLimitCleanup.unref?.();
}

export interface RateLimitResult {
  ok: boolean;
  /** 剩余可用次数. */
  remaining: number;
  /** 距重置还有多少秒. */
  retryAfterSec: number;
  /** 当前计数 (含本次). */
  count: number;
  /** 限额. */
  limit: number;
}

/**
 * 检查 + 增加一次计数.
 *   - 未超: 返回 ok=true, remaining=limit-count
 *   - 已超: 返回 ok=false, 但仍计入 (防持续超量攻击占内存)
 */
export function check(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: limit - 1,
      retryAfterSec: Math.ceil(windowMs / 1000),
      count: 1,
      limit,
    };
  }
  b.count++;
  return {
    ok: b.count <= limit,
    remaining: Math.max(0, limit - b.count),
    retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    count: b.count,
    limit,
  };
}

/** 重置某个 key (登录成功后调用, 清零). */
export function reset(key: string) {
  buckets.delete(key);
}

/** 取客户端 IP (代理链第一跳). 失败时返 'unknown'. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  return 'unknown';
}