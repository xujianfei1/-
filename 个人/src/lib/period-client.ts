/**
 * 经期预测 - 服务端 Flask 网关
 *
 * 设计要点:
 *   - import 'server-only' 强制只在 server side 使用, secret 不会泄露到客户端 bundle
 *   - signRequest 生成 HMAC-SHA256 头, 格式 "<uid>:<unix_ts>" → hex
 *   - flaskFetch 统一: 加签名头 + 解 Flask 的 {code:0,data} 信封 + 错误转 APIError
 *   - cache: 'no-store' 保证预测结果不被 Next.js 缓存
 */
import 'server-only';
import crypto from 'node:crypto';
import { PERIOD_API_URL, PERIOD_SERVICE_SECRET } from './constants';

export class APIError extends Error {
  constructor(public code: number, public httpStatus: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

export interface SignedHeaders {
  'X-Portal-User-Id': string;
  'X-Portal-Timestamp': string;
  'X-Portal-Signature': string;
}

/**
 * 生成 HMAC 签名头
 * @param userId NextAuth session.user.id
 * @param secret 与 Flask 共享的 PERIOD_SERVICE_SECRET
 * @returns 三件套 header
 */
export function signRequest(userId: string, secret: string): SignedHeaders {
  if (!secret) {
    throw new Error('PERIOD_SERVICE_SECRET 未配置');
  }
  const ts = Math.floor(Date.now() / 1000).toString();
  const msg = `${userId}:${ts}`;
  const sig = crypto.createHmac('sha256', secret).update(msg).digest('hex');
  return {
    'X-Portal-User-Id': userId,
    'X-Portal-Timestamp': ts,
    'X-Portal-Signature': sig,
  };
}

interface FlaskEnvelope<T> {
  code: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

/**
 * 调用 Flask 接口, 自动加签名头 + 解包
 * @throws APIError (401 签名错, 5xx 计算异常, 400 入参错)
 */
export async function flaskFetch<T = unknown>(
  path: string,
  init: RequestInit,
  userId: string,
  secret: string = PERIOD_SERVICE_SECRET,
): Promise<T> {
  if (!PERIOD_API_URL) {
    throw new APIError(500, 500, 'PERIOD_API_URL 未配置');
  }
  const url = `${PERIOD_API_URL.replace(/\/$/, '')}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
    ...signRequest(userId, secret),
  };

  let resp: Response;
  try {
    resp = await fetch(url, { ...init, headers, cache: 'no-store' });
  } catch (e) {
    throw new APIError(503, 503, `Flask 服务不可达: ${(e as Error).message}`);
  }

  let json: FlaskEnvelope<T> | null = null;
  try {
    json = (await resp.json()) as FlaskEnvelope<T>;
  } catch {
    throw new APIError(resp.status, resp.status, `Flask 返回非 JSON (HTTP ${resp.status})`);
  }

  if (!json || typeof json !== 'object' || !('code' in json)) {
    throw new APIError(500, resp.status, 'Flask 响应格式异常');
  }

  if (json.code !== 0) {
    throw new APIError(json.code, resp.status, json.message || `Flask 错误 (code=${json.code})`);
  }
  return json.data as T;
}
