/**
 * /updates - 站点更新日志时间线 (公开)
 * admin 可见"记一条"入口
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { HeroBackdrop } from '@/components/hero-backdrop';
import { Markdown } from '@/components/blog/markdown';
import { getChangelogs } from '@/server/changelogs';
import { TYPE_META, type ChangelogType } from '@/lib/changelog-validations';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: '更新日志',
  description: '本站的功能更新与修复记录',
};

export const dynamic = 'force-dynamic';

export default async function UpdatesPage() {
  const [entries, session] = await Promise.all([getChangelogs(), auth()]);
  const isAdmin = !!session?.user?.isAdmin;

  return (
    <div className="relative">
      <HeroBackdrop className="h-[400px] md:h-[440px]" scrim="bg-gradient-to-b from-black/50 via-black/25 to-transparent" />
      <div className="container relative flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col gap-8">
        <div className="relative z-10 flex items-end justify-between gap-4 [&_h1]:text-white [&_h1]:drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] [&_.text-text-muted]:text-white/85">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">更新日志</h1>
            <p className="mt-1 text-sm text-text-muted">本站的功能更新与修复记录 · 共 {entries.length} 条</p>
          </div>
          {isAdmin && (
            <Link
              href="/updates/manage"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/30 bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              记一条
            </Link>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-surface p-10 text-center text-sm text-text-muted">
            暂无更新记录。
          </div>
        ) : (
          <ol className="relative flex flex-col gap-8 border-l border-border/30 pl-6 ml-2">
            {entries.map((e) => {
              const meta = TYPE_META[e.type as ChangelogType] ?? TYPE_META.notice;
              return (
                <li key={e.id} className="relative">
                  {/* 时间线节点 */}
                  <span className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-bg bg-accent" />
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                      {meta.label}
                    </span>
                    <h2 className="text-base font-semibold text-text">{e.title}</h2>
                    <time className="text-xs text-text-faint">{formatDateTime(e.createdAt)}</time>
                  </div>
                  <div className="mt-2 text-sm text-text-muted [&_p]:my-1.5 [&_ul]:my-1.5 [&_li]:my-0.5">
                    <Markdown content={e.body} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </main>
      <Footer />
      </div>
    </div>
  );
}
