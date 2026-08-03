import { getGreeting } from '@/lib/utils';

/**
 * 问候语组件 (RSC)
 * 服务端渲染, 每次请求返回当前时段的问候
 */
export function Greeting() {
  const { greeting, subhead } = getGreeting();
  return (
    <section className="text-center py-6 animate-fade-up">
      <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-3">{greeting}</h1>
      <p className="text-base md:text-lg text-text-muted">{subhead}</p>
    </section>
  );
}
