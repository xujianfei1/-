/**
 * 密码重置 token 工具
 *
 * 设计:
 *   - token 原文 256 bit 随机, 只在邮件中发一次
 *   - DB 存 SHA-256(token), 即使 DB 泄漏也没法反推 token
 *   - 比较用 timingSafeEqual 防时序攻击
 */
import crypto from 'node:crypto';

export const RESET_TOKEN_BYTES = 32;
export const RESET_EXPIRES_MS = 60 * 60 * 1000; // 1h

export function generateResetToken(): string {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function verifyResetToken(plain: string, stored: string): boolean {
  if (plain.length !== stored.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(plain, 'hex'), Buffer.from(stored, 'hex'));
  } catch {
    return false;
  }
}
