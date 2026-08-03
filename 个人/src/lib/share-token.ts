/**
 * 分享 downloadToken 内存存储 (M2 简化, 重启失效)
 *
 * share.access() 验证密码后写入 token, token 1 小时有效.
 * share.download() 验 token 后流式下载.
 *
 * M3 可换成 Redis (持久 + 跨实例).
 */
import { randomBytes } from 'node:crypto';

const tokenStore = new Map<string, { token: string; expiresAt: number }>();

/** 生成一次性 downloadToken 并写入 (覆盖同 shareId 的旧 token) */
export function issueDownloadToken(shareId: string): string {
  const downloadToken = randomBytes(24).toString('base64url');
  tokenStore.set(shareId, {
    token: downloadToken,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 小时
  });
  return downloadToken;
}

/** 验证 downloadToken 是否有效 (未过期 + 匹配). 失效时顺便清理. */
export function verifyDownloadToken(shareId: string, token: string): boolean {
  const e = tokenStore.get(shareId);
  if (!e) return false;
  if (Date.now() > e.expiresAt) {
    tokenStore.delete(shareId);
    return false;
  }
  return e.token === token;
}
