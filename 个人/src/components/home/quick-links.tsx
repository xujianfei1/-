import Link from 'next/link';
import { IconByName } from '@/components/icons';
import type { Link as LinkType } from '@/types';
import { cn } from '@/lib/utils';

export function QuickLinks({ links }: { links: LinkType[] }) {
  return (
    <section className="animate-fade-up [animation-delay:400ms] [animation-fill-mode:both]">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className="h-3.5 w-1 rounded-full bg-accent" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          常用工具
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {links.map((l) => (
          <Link
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'group flex items-center gap-2.5 rounded-xl bg-surface/60 px-3.5 py-2.5',
              'text-sm font-medium text-text-muted transition-all duration-200',
              'hover:bg-surface hover:text-accent hover:shadow-sm',
              'border border-transparent hover:border-accent/30',
            )}
          >
            <span className="text-text-faint transition-colors group-hover:text-accent">
              <IconByName name={l.icon} className="h-4 w-4" />
            </span>
            <span>{l.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
