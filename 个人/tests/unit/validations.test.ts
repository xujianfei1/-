/**
 * 单元测试: Zod 校验
 */
import { describe, it, expect } from 'vitest';
import {
  serviceCreateSchema,
  serviceUpdateSchema,
  linkCreateSchema,
  registerSchema,
} from '@/lib/validations';

describe('serviceCreateSchema', () => {
  it('接受合法的完整数据', () => {
    const result = serviceCreateSchema.safeParse({
      name: '仪表盘',
      description: '个人仪表盘',
      url: 'https://example.com',
      icon: 'home',
      status: 'online',
    });
    expect(result.success).toBe(true);
  });

  it('url 可选为 null', () => {
    const result = serviceCreateSchema.safeParse({
      name: '博客',
      description: '开发中',
      url: null,
    });
    expect(result.success).toBe(true);
  });

  it('name 为空时失败', () => {
    const result = serviceCreateSchema.safeParse({
      name: '',
      description: 'desc',
    });
    expect(result.success).toBe(false);
  });

  it('status 不在枚举内时失败', () => {
    const result = serviceCreateSchema.safeParse({
      name: 'x',
      description: 'y',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('serviceUpdateSchema', () => {
  it('允许部分更新', () => {
    const result = serviceUpdateSchema.safeParse({ name: '新名字' });
    expect(result.success).toBe(true);
  });
});

describe('linkCreateSchema', () => {
  it('url 无效时失败', () => {
    const result = linkCreateSchema.safeParse({ name: 'GitHub', url: 'not-a-url' });
    expect(result.success).toBe(false);
  });
});

describe('registerSchema', () => {
  it('密码少于 6 位时失败', () => {
    const result = registerSchema.safeParse({
      name: 'Xu',
      email: 'me@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
  });

  it('邮箱格式无效时失败', () => {
    const result = registerSchema.safeParse({
      name: 'Xu',
      email: 'invalid',
      password: '123456',
    });
    expect(result.success).toBe(false);
  });
});
