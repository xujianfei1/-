import { SERVICE_STATUS_MAP } from '@/lib/constants';
import type { ServiceStatus as ServiceStatusType } from '@/lib/validations';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: ServiceStatusType }) {
  const cfg = SERVICE_STATUS_MAP[status];
  const isOnline = status === 'online';

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        cfg.variant === 'success' && 'border-success/20 bg-success/10 text-success',
        cfg.variant === 'warning' && 'border-warning/20 bg-warning/10 text-warning',
        cfg.variant === 'info' && 'border-info/20 bg-info/10 text-info',
        cfg.variant === 'muted' && 'border-border bg-surface text-text-muted',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full bg-current',
          isOnline && 'animate-pulse-soft shadow-[0_0_6px_currentColor]',
        )}
      />
      {cfg.label}
    </span>
  );
}
