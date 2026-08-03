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
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">我的服务</h2>
        <span className="inline-flex items-center justify-center min-w-[20px] rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-faint">
          {onlineCount} 个在线
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
        {services.map((s, i) => (
          <ServiceCard key={s.id} service={s} index={i} />
        ))}
      </div>
    </section>
  );
}
