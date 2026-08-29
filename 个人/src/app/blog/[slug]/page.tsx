/**
 * /blog/[slug] - 文章详情 (公开)
 * - 草稿仅 admin 可见, 其余 404 (不暴露存在性)
 * - 每次公开访问阅读量 +1
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, Eye } from 'lucide-react';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { Markdown } from '@/components/blog/markdown';
import { Comments } from '@/components/blog/comments';
import { CinemaStill } from '@/components/blog/cinema-still';
import { cinemaPaletteFor } from '@/lib/cinema';
import { getPublishedPostBySlug, incrementViews } from '@/server/posts';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post || post.status !== 'published') {
    return { title: '文章不存在' };
  }
  return {
    title: post.title,
    description: post.summary ?? undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, session] = await Promise.all([getPublishedPostBySlug(slug), auth()]);
  const isAdmin = !!session?.user?.isAdmin;

  // 草稿: 仅 admin 可见, 其余一律 404
  if (!post || (post.status !== 'published' && !isAdmin)) {
    notFound();
  }

  let views = post.views;
  if (post.status === 'published') {
    const r = await incrementViews(slug);
    views = r.views;
  }

  const tags = post.tags ? post.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const palette = cinemaPaletteFor(post.slug);

  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col gap-6">
        <Link
          href="/blog"
          className="inline-flex w-fit items-center gap-1 text-sm text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回博客
        </Link>

        <article className="overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-16px_rgba(0,0,0,0.10)] dark:border-white/[0.06]">
          <CinemaStill slug={post.slug}>
            {post.status === 'draft' && (
              <span className="mb-4 rounded-full bg-warning/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                草稿 (仅管理员可见)
              </span>
            )}
            <h1
              className="max-w-3xl text-2xl font-bold leading-snug tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] md:text-4xl"
              style={{ color: palette.ink }}
            >
              {post.title}
            </h1>
          </CinemaStill>
          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-3 border-b border-border/20 pb-5 text-xs text-text-faint">
              <time>{formatDate(post.publishedAt ?? post.updatedAt)}</time>
              {post.status === 'published' && (
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {views} 次阅读
                </span>
              )}
              {tags.length > 0 && (
                <span className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </div>

            <div className="pt-6">
              <Markdown content={post.content} />
            </div>
          </div>
        </article>

        <Comments
          slug={post.slug}
          currentUser={
            session?.user
              ? {
                  id: session.user.id,
                  name: session.user.name ?? session.user.email ?? '用户',
                  isAdmin: !!session.user.isAdmin,
                }
              : null
          }
        />
      </main>
      <Footer />
    </div>
  );
}
