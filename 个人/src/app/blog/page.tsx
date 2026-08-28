/**
 * /blog - 博客列表 (公开)
 * RSC 直读 DB; 支持站内搜索 (?q=); 管理员可见"写文章"入口
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { getPublishedPosts, searchPublishedPosts } from '@/server/posts';
import { formatDate } from '@/lib/utils';
import { Pencil, Rss, Search, X } from 'lucide-react';

export const metadata: Metadata = {
  title: '博客',
  description: '技术文章和思考分享',
  alternates: { types: { 'application/rss+xml': '/blog/feed.xml' } },
};

export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function BlogPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const kw = q?.trim() || '';
  const [posts, session] = await Promise.all([
    kw ? searchPublishedPosts(kw) : getPublishedPosts(),
    auth(),
  ]);
  const isAdmin = !!session?.user?.isAdmin;

  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col gap-8">
        <header className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold md:text-3xl">博客</h1>
            <p className="mt-1 text-sm text-text-muted">
              技术文章和思考分享 · 共 {posts.length} 篇
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="/blog/feed.xml"
              title="RSS 订阅"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-surface px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <Rss className="h-3.5 w-3.5" />
              RSS
            </a>
            {isAdmin && (
              <Link
                href="/blog/write"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-surface px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
              >
                <Pencil className="h-3.5 w-3.5" />
                写文章
              </Link>
            )}
          </div>
        </header>

        {/* 站内搜索 */}
        <form action="/blog" method="get" className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
            <input
              name="q"
              defaultValue={kw}
              placeholder="搜索标题、摘要、标签或正文…"
              maxLength={80}
              className="w-full rounded-lg border border-border/30 bg-surface py-2 pl-9 pr-3 text-sm text-text outline-none transition-colors focus:border-accent"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-border/30 bg-surface px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
          >
            搜索
          </button>
          {kw && (
            <Link
              href="/blog"
              className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-accent"
            >
              <X className="h-3.5 w-3.5" />
              清除
            </Link>
          )}
        </form>

        {kw && (
          <p className="-mt-4 text-sm text-text-muted">
            关键词「<span className="text-text">{kw}</span>」的搜索结果
          </p>
        )}

        {posts.length === 0 ? (
          <div className="rounded-xl border border-border/30 bg-surface p-10 text-center text-sm text-text-muted">
            {kw ? '没有匹配的文章, 换个关键词试试。' : '还没有发布任何文章, 敬请期待。'}
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {posts.map((post) => {
              const tags = post.tags ? post.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
              return (
                <li key={post.id}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group block rounded-xl border border-border/30 bg-surface p-5 transition-all duration-300 hover:border-accent/50 hover:shadow-sm"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-base font-medium text-text transition-colors group-hover:text-accent md:text-lg">
                        {post.title}
                      </h2>
                      <time className="shrink-0 text-xs text-text-faint">
                        {formatDate(post.publishedAt ?? post.updatedAt)}
                      </time>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm text-text-muted">
                      {post.summary || '点击阅读全文…'}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-text-faint">
                      {tags.length > 0 && (
                        <span className="flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                              {t}
                            </span>
                          ))}
                        </span>
                      )}
                      <span>{post.views} 次阅读</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
