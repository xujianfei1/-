/**
 * SM-2 间隔重复算法单元测试
 */
import { describe, it, expect } from 'vitest';
import { reviewSm2, judgeSpell, SRS_MIN_EASE, type SrsState } from '@/lib/srs';

const fresh: SrsState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
const now = new Date('2026-09-01T00:00:00Z');

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

describe('reviewSm2', () => {
  it('新词首学(q=5): 间隔 1 天, EF +0.1', () => {
    const r = reviewSm2(fresh, 5, now);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(r.easeFactor).toBe(2.6);
    expect(daysBetween(now, r.dueAt)).toBe(1);
  });

  it('连续正确: 间隔 1 → 6 → 按 EF 递增', () => {
    const r1 = reviewSm2(fresh, 5, now); // EF 2.6
    const r2 = reviewSm2(r1, 5, now);    // interval 6, EF 2.7
    expect(r2.intervalDays).toBe(6);
    const r3 = reviewSm2(r2, 5, now);    // round(6*2.8)=17
    expect(r3.intervalDays).toBe(17);
    expect(daysBetween(now, r3.dueAt)).toBe(17);
  });

  it('答错(q<3): 重置为 1 天, repetitions=0, EF 下降', () => {
    const learned: SrsState = { easeFactor: 2.5, intervalDays: 15, repetitions: 3 };
    const r = reviewSm2(learned, 2, now);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(0);
    expect(r.easeFactor).toBeCloseTo(2.3);
    expect(daysBetween(now, r.dueAt)).toBe(1);
  });

  it('EF 下限 1.3 不再下降', () => {
    const low: SrsState = { easeFactor: 1.3, intervalDays: 3, repetitions: 2 };
    const r = reviewSm2(low, 2, now);
    expect(r.easeFactor).toBe(SRS_MIN_EASE);
  });

  it('q=4 时 EF 不变 (SM-2 公式下恰好为 0), 间隔仍递增', () => {
    const r1 = reviewSm2(fresh, 4, now);
    expect(r1.easeFactor).toBe(2.5);
    const r2 = reviewSm2(r1, 4, now);
    expect(r2.intervalDays).toBe(6);
  });

  it('EF 上限 2.8', () => {
    let s: SrsState = { ...fresh };
    for (let i = 0; i < 20; i++) {
      s = reviewSm2(s, 5, now);
    }
    expect(s.easeFactor).toBeLessThanOrEqual(2.8);
  });

  it('quality 越界值被钳制', () => {
    expect(() => reviewSm2(fresh, -1, now)).not.toThrow();
    expect(() => reviewSm2(fresh, 9, now)).not.toThrow();
    const r = reviewSm2(fresh, 9, now);
    expect(r.intervalDays).toBe(1); // 9 → 钳为 5
  });
});

describe('judgeSpell', () => {
  it('完全一致 (忽略大小写与首尾空格): correct q=5', () => {
    expect(judgeSpell('  Access ', 'access')).toEqual({ verdict: 'correct', quality: 5 });
  });

  it('单复数差异: near q=3', () => {
    expect(judgeSpell('accesss', 'access')).toEqual({ verdict: 'near', quality: 3 });
    expect(judgeSpell('book', 'books')).toEqual({ verdict: 'near', quality: 3 });
  });

  it('连字符差异: near', () => {
    expect(judgeSpell('mother in law', 'mother-in-law')).toEqual({ verdict: 'near', quality: 3 });
  });

  it('完全错误: wrong q=1', () => {
    expect(judgeSpell('banana', 'access')).toEqual({ verdict: 'wrong', quality: 1 });
    expect(judgeSpell('', 'access')).toEqual({ verdict: 'wrong', quality: 1 });
  });
});
