import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { TYPE_META, type ChangelogType } from '@/lib/changelog-validations';
import { formatDate } from '@/lib/utils';
import type { Changelog } from '@prisma/client';

/**
 * 主页"最近更新"区块 (RSC): 展示最新 3 条, 链接到 /updates
 */
export function RecentUpdates({ entries }: { entries: Changelog[] }) {
  return (
    <section className="animate-fade-up [animation-delay:400ms] [animation-fill-mode:both]">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            最近更新
          </h2>
        </div>
        <Link
          href="/updates"
          className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
        >
          全部
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="px-1 text-sm text-text-faint">暂无更新记录。</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((e) => {
            const meta = TYPE_META[e.type as ChangelogType] ?? TYPE_META.notice;
            return (
              <li key={e.id}>
                <Link
                  href="/updates"
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-muted transition-colors group-hover:text-text">
                    {e.title}
                  </span>
                  <time className="shrink-0 text-xs text-text-faint">
                    {formatDate(e.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
