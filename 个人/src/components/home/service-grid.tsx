import { ServiceCard } from './service-card';
import type { Service } from '@/types';

export function ServiceGrid({
  services,
  onlineCount,
}: {
  services: Service[];
  onlineCount: number;
}) {
  return (
    <section className="animate-fade-up [animation-delay:300ms] [animation-fill-mode:both]">
      <div className="mb-4 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">我的服务</h2>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
          {onlineCount} 个在线
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3.5">
        {services.map((s, i) => (
          <ServiceCard key={s.id} service={s} index={i} />
        ))}
      </div>
    </section>
  );
}
