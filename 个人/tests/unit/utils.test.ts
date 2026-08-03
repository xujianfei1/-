/**
 * 单元测试: 工具函数
 */
import { describe, it, expect } from 'vitest';
import { cn, getGreeting, isValidUrl, formatDate } from '@/lib/utils';

describe('cn', () => {
  it('合并 className, 后者覆盖前者', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});

describe('getGreeting', () => {
  it('早上 8 点返回"早上好"', () => {
    expect(getGreeting(8).greeting).toBe('早上好');
  });
  it('中午 12 点返回"中午好"', () => {
    expect(getGreeting(12).greeting).toBe('中午好');
  });
  it('下午 15 点返回"下午好"', () => {
    expect(getGreeting(15).greeting).toBe('下午好');
  });
  it('晚上 20 点返回"晚上好"', () => {
    expect(getGreeting(20).greeting).toBe('晚上好');
  });
  it('凌晨 3 点返回"夜深了"', () => {
    expect(getGreeting(3).greeting).toBe('夜深了');
  });
  it('深夜 23 点返回"夜深了"', () => {
    expect(getGreeting(23).greeting).toBe('夜深了');
  });
});

describe('isValidUrl', () => {
  it('github.com 是合法 URL', () => {
    expect(isValidUrl('github.com')).toBe(true);
  });
  it('包含协议也是合法', () => {
    expect(isValidUrl('https://example.com/path')).toBe(true);
  });
  it('空字符串不是合法 URL', () => {
    expect(isValidUrl('')).toBe(false);
  });
  it('含空格的字符串不是合法 URL', () => {
    expect(isValidUrl('hello world')).toBe(false);
  });
});

describe('formatDate', () => {
  it('格式化 Date 对象', () => {
    expect(formatDate(new Date('2024-01-15'))).toBe('2024/01/15');
  });
  it('接受字符串', () => {
    expect(formatDate('2024-12-25')).toBe('2024/12/25');
  });
});
