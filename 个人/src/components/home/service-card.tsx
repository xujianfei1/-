import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { IconByName } from '@/components/icons';
import { StatusBadge } from '@/components/shared/status-badge';
import type { Service } from '@/types';
import { cn } from '@/lib/utils';

export function ServiceCard({ service, index = 0 }: { service: Service; index?: number }) {
  const cardClasses = cn(
    'group relative flex items-center gap-4 rounded-2xl bg-surface p-4 md:p-5',
    'border border-black/[0.06] dark:border-white/[0.06]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-16px_rgba(0,0,0,0.10)]',
    'transition-all duration-300 ease-out',
    'hover:-translate-y-1 hover:border-accent/40',
    'hover:shadow-[0_2px_4px_rgba(0,0,0,0.04),0_16px_40px_-16px_rgba(0,0,0,0.18)]',
    'animate-fade-up',
  );

  const inner = (
    <>
      {/* 图标砖: hover 时点亮为品牌渐变 */}
      <div className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-accent group-hover:to-amber-400 group-hover:text-white group-hover:shadow-md group-hover:shadow-accent/30">
        <IconByName name={service.icon} className="h-5 w-5" />
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
          {service.name}
          {service.url && (
            <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 text-accent transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-text-muted">{service.description}</div>
      </div>
      <StatusBadge status={service.status} />
    </>
  );

  if (!service.url) {
    return (
      <div
        className={cn(cardClasses, 'opacity-55 saturate-50 cursor-not-allowed')}
        data-service-search={`${service.name} ${service.description}`}
        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={service.url}
      rel="noopener noreferrer"
      className={cardClasses}
      data-service-search={`${service.name} ${service.description}`}
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      {inner}
    </Link>
  );
}
