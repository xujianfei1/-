/**
 * 电影感调色工具
 * 按 slug 确定性分配一套"调色"配色 (经典青橙 / 蓝调午夜 / 金色暮光 ...),
 * 供 CinemaStill 剧照组件与 OG 分享图共用, 同一篇文章永远同一张"剧照"底色。
 */

export interface CinemaPalette {
  /** 调色名称 */
  name: string;
  /** 主渐变: 深 → 亮 */
  from: string;
  to: string;
  /** 点缀光斑颜色 */
  glow: string;
  /** 题卡文字颜色 */
  ink: string;
}

/** 经典电影调色 (取自常见 grade 风格) */
export const CINEMA_PALETTES: CinemaPalette[] = [
  {
    name: '青橙 Teal & Orange',
    from: 'hsl(200 45% 12%)',
    to: 'hsl(24 55% 42%)',
    glow: 'hsl(35 85% 60%)',
    ink: 'hsl(36 90% 88%)',
  },
  {
    name: '蓝调午夜 Midnight',
    from: 'hsl(225 45% 10%)',
    to: 'hsl(210 55% 34%)',
    glow: 'hsl(195 80% 62%)',
    ink: 'hsl(196 90% 88%)',
  },
  {
    name: '金色暮光 Golden Hour',
    from: 'hsl(28 55% 14%)',
    to: 'hsl(38 70% 40%)',
    glow: 'hsl(48 90% 64%)',
    ink: 'hsl(46 95% 88%)',
  },
  {
    name: '墨绿霓虹 Neon Noir',
    from: 'hsl(170 40% 9%)',
    to: 'hsl(165 45% 28%)',
    glow: 'hsl(158 80% 55%)',
    ink: 'hsl(160 90% 86%)',
  },
  {
    name: '褪色胶片 Faded Film',
    from: 'hsl(20 15% 16%)',
    to: 'hsl(35 25% 45%)',
    glow: 'hsl(42 55% 70%)',
    ink: 'hsl(40 40% 90%)',
  },
  {
    name: '黑金 Black & Gold',
    from: 'hsl(240 8% 8%)',
    to: 'hsl(40 40% 26%)',
    glow: 'hsl(45 85% 58%)',
    ink: 'hsl(45 90% 86%)',
  },
];

/** 简单字符串 hash (确定性) */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** 按 slug 确定性取一套调色 */
export function cinemaPaletteFor(slug: string): CinemaPalette {
  return CINEMA_PALETTES[hashString(slug) % CINEMA_PALETTES.length]!;
}
