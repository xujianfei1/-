/**
 * 首页电影感 hero 背景
 * 按"每小时轮换"策略从图库中取图 (本地时区), 图库按时段主题排序:
 * dawn(黎明) → morning(上午) → noon(正午) → afternoon(午后) → dusk(黄昏) → night(深夜)
 */
export const HERO_COUNT = 6;

export function heroSrcForHour(hour: number): string {
  const idx = ((hour % HERO_COUNT) + HERO_COUNT) % HERO_COUNT;
  return `/images/hero/hero-${idx}.jpg`;
}

export function heroSrcNow(now: Date = new Date()): string {
  return heroSrcForHour(now.getHours());
}
