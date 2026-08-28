import { getGreeting } from '@/lib/utils';

/**
 * 问候语组件 (RSC)
 * 服务端渲染, 每次请求返回当前时段的问候
 */
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function Greeting() {
  const { greeting, subhead } = getGreeting();
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${WEEKDAYS[now.getDay()]}`;

  return (
    <section className="py-8 text-center animate-fade-up md:py-12">
      <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-text-faint">
        {dateLabel}
      </p>
      <h1 className="text-5xl font-bold tracking-tight md:text-6xl">{greeting}</h1>
      <p className="mt-4 text-base text-text-muted md:text-lg">{subhead}</p>
    </section>
  );
}
