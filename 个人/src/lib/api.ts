/**
 * API 客户端 (前端使用)
 * 基于 fetch, 统一错误处理
 */
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};

  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new APIError(res.status, data?.error || res.statusText, data);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiGet = <T>(path: string) => api<T>(path, { method: 'GET' });
export const apiPost = <T>(path: string, json: unknown) => api<T>(path, { method: 'POST', json });
export const apiPut = <T>(path: string, json: unknown) => api<T>(path, { method: 'PUT', json });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
