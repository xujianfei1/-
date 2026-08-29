import { describe, it, expect } from 'vitest';
import { heroSrcForHour, HERO_COUNT } from '@/lib/hero-bg';

describe('heroSrcForHour', () => {
  it('按小时返回对应图', () => {
    expect(heroSrcForHour(0)).toBe('/images/hero/hero-0.jpg');
    expect(heroSrcForHour(7)).toBe('/images/hero/hero-1.jpg');
    expect(heroSrcForHour(13)).toBe('/images/hero/hero-1.jpg');
  });

  it('在图库数量处回绕', () => {
    expect(heroSrcForHour(6)).toBe('/images/hero/hero-0.jpg');
    expect(heroSrcForHour(23)).toBe(`/images/hero/hero-${23 % HERO_COUNT}.jpg`);
  });

  it('负数小时也能回绕 (防御)', () => {
    expect(heroSrcForHour(-1)).toBe(`/images/hero/hero-${HERO_COUNT - 1}.jpg`);
  });
});
