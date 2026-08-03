import Link from 'next/link';
import { IconByName } from '@/components/icons';
import type { Link as LinkType } from '@/types';
import { cn } from '@/lib/utils';

export function QuickLinks({ links }: { links: LinkType[] }) {
  return (
    <section className="animate-fade-up [animation-delay:400ms] [animation-fill-mode:both]">
      <div className="mb-4 flex items-center px-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-muted">常用工具</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
        {links.map((l) => (
          <Link
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5',
              'text-sm font-medium text-text transition-all duration-200',
              'hover:border-accent hover:text-accent hover:-translate-y-0.5 hover:shadow-sm',
            )}
          >
            <span className="text-text-muted transition-colors group-hover:text-accent">
              <IconByName name={l.icon} className="h-4 w-4" />
            </span>
            <span>{l.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
