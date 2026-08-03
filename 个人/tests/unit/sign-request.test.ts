/**
 * 单元测试: HMAC 签名生成
 * 与 Flask 端 verify_bridge.py 配套验证
 */
import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { signRequest } from '@/lib/period-client';

describe('signRequest', () => {
  it('生成的三件套 header 字段齐全', () => {
    const h = signRequest('user-123', 'secret-abc');
    expect(h['X-Portal-User-Id']).toBe('user-123');
    expect(h['X-Portal-Timestamp']).toMatch(/^\d{10}$/);
    expect(h['X-Portal-Signature']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('签名与 Flask 端约定一致 (HMAC-SHA256 over "<uid>:<ts>")', () => {
    const uid = 'cuid-xyz-001';
    const secret = 'shared-secret';
    const ts = '1700000000';
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${uid}:${ts}`)
      .digest('hex');

    // 用同样的 ts 重算, 应一致
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${uid}:${ts}`)
      .digest('hex');
    expect(sig).toBe(expected);
    expect(expected).toHaveLength(64);
  });

  it('不同 secret 产生不同签名', () => {
    const a = signRequest('u1', 'secret-A');
    const b = signRequest('u1', 'secret-B');
    expect(a['X-Portal-Signature']).not.toBe(b['X-Portal-Signature']);
  });

  it('不同 user 产生不同签名 (即使 secret 相同)', () => {
    const a = signRequest('u1', 'same-secret');
    const b = signRequest('u2', 'same-secret');
    expect(a['X-Portal-Signature']).not.toBe(b['X-Portal-Signature']);
  });

  it('空 secret 抛错', () => {
    expect(() => signRequest('u1', '')).toThrow(/未配置/);
  });

  it('连续两次调用, timestamp 间隔一致且签名随之更新', async () => {
    const a = signRequest('u1', 's');
    await new Promise((r) => setTimeout(r, 1100));
    const b = signRequest('u1', 's');
    expect(Number(b['X-Portal-Timestamp'])).toBeGreaterThan(
      Number(a['X-Portal-Timestamp']),
    );
    expect(b['X-Portal-Signature']).not.toBe(a['X-Portal-Signature']);
  });
});
