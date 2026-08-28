/**
 * GET    /api/blog/[slug]  - 文章详情 (公开; 草稿仅 admin 可读, 其余一律 404 不暴露存在性)
 * PUT    /api/blog/[slug]  - 更新 (仅 admin; URL 段是当前 slug, body 里可带新 slug)
 * DELETE /api/blog/[slug]  - 删除 (仅 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { postUpdateSchema } from '@/lib/blog-validations';
import { getPublishedPostBySlug, updatePost, deletePost } from '@/server/posts';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    const post = await getPublishedPostBySlug(slug);
    if (!post) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    if (post.status !== 'published') {
      const auth = await requireAdmin();
      if ('error' in auth) return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    return NextResponse.json({ data: post });
  } catch (err) {
    console.error('GET /api/blog/[slug] failed:', err);
    return NextResponse.json({ error: '获取文章失败' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { slug } = await ctx.params;
    const existing = await getPublishedPostBySlug(slug);
    if (!existing) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    const body = await req.json();
    const parsed = postUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    try {
      const post = await updatePost(existing.id, parsed.data);
      return NextResponse.json({ data: post });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'slug 已被占用, 换一个' }, { status: 409 });
      }
      throw e;
    }
  } catch (err) {
    console.error('PUT /api/blog/[slug] failed:', err);
    return NextResponse.json({ error: '更新文章失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { slug } = await ctx.params;
    const existing = await getPublishedPostBySlug(slug);
    if (!existing) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    await deletePost(existing.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/blog/[slug] failed:', err);
    return NextResponse.json({ error: '删除文章失败' }, { status: 500 });
  }
}
