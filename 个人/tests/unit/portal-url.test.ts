/**
 * 单元测试: 子域 → 门户 URL 转换
 */
import { describe, it, expect } from 'vitest';
import { portalUrlFor } from '@/lib/portal-url';

describe('portalUrlFor', () => {
  it('生产域名 period.xujianfei.cn → xujianfei.cn', () => {
    expect(portalUrlFor('period.xujianfei.cn')).toBe('https://xujianfei.cn');
  });

  it('带端口也正确剥掉', () => {
    expect(portalUrlFor('period.xujianfei.cn:443')).toBe('https://xujianfei.cn');
    expect(portalUrlFor('period.xujianfei.cn:3000')).toBe('https://xujianfei.cn');
  });

  it('大写 host 也行', () => {
    expect(portalUrlFor('PERIOD.xujianfei.cn')).toBe('https://xujianfei.cn');
  });

  it('开发期 period.localhost → localhost', () => {
    expect(portalUrlFor('period.localhost')).toBe('https://localhost');
  });

  it('开发期 period.test → test', () => {
    expect(portalUrlFor('period.test')).toBe('https://test');
  });

  it('同域 (me.xujianfei.cn) → null (不显示返回链接)', () => {
    expect(portalUrlFor('me.xujianfei.cn')).toBeNull();
  });

  it('主域 (xujianfei.cn) → null', () => {
    expect(portalUrlFor('xujianfei.cn')).toBeNull();
  });

  it('IP 直连 → null', () => {
    expect(portalUrlFor('10.29.23.170')).toBeNull();
    expect(portalUrlFor('114.215.182.68:3000')).toBeNull();
  });

  it('localhost → null', () => {
    expect(portalUrlFor('localhost')).toBeNull();
    expect(portalUrlFor('localhost:3000')).toBeNull();
  });

  it('null / undefined / 空 → null', () => {
    expect(portalUrlFor(null)).toBeNull();
    expect(portalUrlFor(undefined)).toBeNull();
    expect(portalUrlFor('')).toBeNull();
  });

  it('非 period 子域 (如 blog.xujianfei.cn) → null (不误判)', () => {
    expect(portalUrlFor('blog.xujianfei.cn')).toBeNull();
    expect(portalUrlFor('price.xujianfei.cn')).toBeNull();
  });
});
