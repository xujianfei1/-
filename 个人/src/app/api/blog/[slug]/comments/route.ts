/**
 * GET  /api/blog/[slug]/comments  - 评论列表 (公开)
 * POST /api/blog/[slug]/comments  - 发表评论 (仅登录用户; 草稿文章仅 admin 可评)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser, auth } from '@/lib/auth';
import { commentCreateSchema } from '@/lib/blog-validations';
import { getPublishedPostBySlug, getComments, addComment } from '@/server/posts';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    const post = await getPublishedPostBySlug(slug);
    if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    const comments = await getComments(post.id);
    return NextResponse.json({ data: comments });
  } catch (err) {
    console.error('GET comments failed:', err);
    return NextResponse.json({ error: '获取评论失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: '请先登录后评论' }, { status: a.status });
  try {
    const { slug } = await ctx.params;
    const post = await getPublishedPostBySlug(slug);
    if (!post) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    // 草稿文章仅 admin 可评
    if (post.status !== 'published') {
      const session = await auth();
      if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: '文章不存在' }, { status: 404 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const parsed = commentCreateSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors.body?.[0] ?? '评论内容无效';
      return NextResponse.json({ error: first }, { status: 400 });
    }

    const comment = await addComment(post.id, a.session.user.id, parsed.data.body.trim());
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    console.error('POST comments failed:', err);
    return NextResponse.json({ error: '发表评论失败' }, { status: 500 });
  }
}
