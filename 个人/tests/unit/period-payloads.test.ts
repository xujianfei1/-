/**
 * 单元测试: 经期预测 Zod 校验
 */
import { describe, it, expect } from 'vitest';
import {
  cycleCreateSchema,
  predictRequestSchema,
  predictModeSchema,
} from '@/lib/period-validations';

describe('cycleCreateSchema', () => {
  it('接受合法 startDate / periodDays', () => {
    const r = cycleCreateSchema.safeParse({
      startDate: '2026-05-20',
      periodDays: 5,
    });
    expect(r.success).toBe(true);
  });

  it('startDate 格式错误时失败', () => {
    const r = cycleCreateSchema.safeParse({
      startDate: '2026/05/20',
      periodDays: 5,
    });
    expect(r.success).toBe(false);
  });

  it('periodDays 越界 (>10) 失败', () => {
    const r = cycleCreateSchema.safeParse({
      startDate: '2026-05-20',
      periodDays: 15,
    });
    expect(r.success).toBe(false);
  });

  it('periodDays 缺省时默认 5', () => {
    const r = cycleCreateSchema.parse({ startDate: '2026-05-20' });
    expect(r.periodDays).toBe(5);
  });

  it('notes 可选为 null', () => {
    const r = cycleCreateSchema.safeParse({
      startDate: '2026-05-20',
      periodDays: 5,
      notes: null,
    });
    expect(r.success).toBe(true);
  });
});

describe('predictRequestSchema', () => {
  it('空 body 时 mode/pmsDays 走默认', () => {
    const r = predictRequestSchema.parse({});
    expect(r.mode).toBe('normal');
    expect(r.pmsDays).toBe(7);
  });

  it('mode 不在枚举内失败', () => {
    const r = predictRequestSchema.safeParse({ mode: 'foo' });
    expect(r.success).toBe(false);
  });

  it('specialFactors 全部可缺省', () => {
    const r = predictRequestSchema.parse({ mode: 'ttc' });
    expect(r.specialFactors).toEqual({});
    expect(r.chronicConditions).toEqual([]);
  });

  it('chronicConditions 为字符串数组', () => {
    const r = predictRequestSchema.parse({
      mode: 'normal',
      chronicConditions: ['PCOS', '甲状腺'],
    });
    expect(r.chronicConditions).toEqual(['PCOS', '甲状腺']);
  });
});

describe('predictModeSchema', () => {
  it('接受 normal / ttc / contraception', () => {
    expect(predictModeSchema.parse('normal')).toBe('normal');
    expect(predictModeSchema.parse('ttc')).toBe('ttc');
    expect(predictModeSchema.parse('contraception')).toBe('contraception');
  });

  it('拒绝未知 mode', () => {
    expect(predictModeSchema.safeParse('xyz').success).toBe(false);
  });
});
