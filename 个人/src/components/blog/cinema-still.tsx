import { cinemaPaletteFor } from '@/lib/cinema';
import { cn } from '@/lib/utils';

/**
 * 电影剧照封面 (纯 CSS, 无图片资源)
 * - 按 slug 确定性取电影调色 (同一篇永远是同一张"剧照")
 * - 分层: 双色渐变 + 光斑 + 暗角 + 胶片颗粒 + 上下遮幅线
 * - 可选 children 作为题卡 (电影海报式标题排版)
 */
export function CinemaStill({
  slug,
  className,
  children,
  ratio = 'aspect-[21/9]',
}: {
  slug: string;
  className?: string;
  children?: React.ReactNode;
  ratio?: string;
}) {
  const p = cinemaPaletteFor(slug);

  return (
    <div className={cn('relative overflow-hidden bg-black', ratio, className)}>
      {/* 底色渐变 */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(118deg, ${p.from} 0%, ${p.to} 100%)` }}
      />
      {/* 光斑 (模拟片场光源) */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 45% 65% at 72% 30%, ${p.glow} 0%, transparent 55%),
                       radial-gradient(ellipse 30% 45% at 15% 80%, ${p.glow} 0%, transparent 60%)`,
          opacity: 0.5,
        }}
      />
      {/* 暗角 */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)' }}
      />
      {/* 胶片颗粒 (SVG 噪声) */}
      <div
        className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* 上下遮幅线 */}
      <div className="absolute inset-x-0 top-0 h-[6%] bg-black/80" />
      <div className="absolute inset-x-0 bottom-0 h-[6%] bg-black/80" />
      {/* 题卡插槽 */}
      {children && (
        <div className="absolute inset-[6%] flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
