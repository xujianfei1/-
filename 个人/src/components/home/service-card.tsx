import Link from 'next/link';
import { IconByName } from '@/components/icons';
import { StatusBadge } from '@/components/shared/status-badge';
import type { Service } from '@/types';
import { cn } from '@/lib/utils';

export function ServiceCard({ service, index = 0 }: { service: Service; index?: number }) {
  const cardClasses = cn(
    'group relative flex items-center gap-3.5 p-4 bg-surface border border-border rounded-xl overflow-hidden',
    'transition-all duration-300 ease-out',
    'hover:border-accent hover:-translate-y-0.5 hover:shadow-lg',
    'animate-fade-up',
  );

  const inner = (
    <>
      <div className="absolute inset-0 bg-gradient-to-br from-accent-soft to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
      <div className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
        <IconByName name={service.icon} className="h-5 w-5" />
      </div>
      <div className="relative z-10 flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{service.name}</div>
        <div className="text-xs text-text-muted truncate">{service.description}</div>
      </div>
      <StatusBadge status={service.status} />
    </>
  );

  if (!service.url) {
    return (
      <div
        className={cn(cardClasses, 'opacity-55 cursor-not-allowed')}
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
