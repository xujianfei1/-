import { heroSrcNow } from '@/lib/hero-bg';
import { preload } from 'react-dom';

/**
 * 电影感 hero 背景 (每小时轮换的时段剧照)
 * 放在 relative 容器内使用, 绝对定位于顶部; 各页面通过 props 调整高度与遮罩强度
 */
export function HeroBackdrop({
  className = 'h-[560px] md:h-[640px]',
  scrim = 'bg-gradient-to-b from-black/40 via-black/15 to-transparent',
  fadeToBg = true,
}: {
  className?: string;
  /** 压暗遮罩, 保证页面文字/控件可读 */
  scrim?: string;
  /** 底部渐变融入页面背景色 */
  fadeToBg?: boolean;
}) {
  const src = heroSrcNow();
  preload(src, { as: 'image' });

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 top-0 overflow-hidden animate-fade-in ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
      <div className={`absolute inset-0 ${scrim}`} />
      {fadeToBg && <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-bg" />}
    </div>
  );
}
