/**
 * GET  /api/blog       - 已发布文章列表 (公开, 不含正文)
 * GET  /api/blog?all=1 - 全量列表含草稿 (仅 admin, 编辑器用)
 * POST /api/blog       - 创建文章 (仅 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdmin } from '@/lib/auth';
import { postCreateSchema } from '@/lib/blog-validations';
import { getPublishedPosts, getAllPosts, createPost } from '@/server/posts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get('all') === '1') {
      const auth = await requireAdmin();
      if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
      return NextResponse.json({ data: await getAllPosts() });
    }
    return NextResponse.json({ data: await getPublishedPosts() });
  } catch (err) {
    console.error('GET /api/blog failed:', err);
    return NextResponse.json({ error: '获取文章列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await req.json();
    const parsed = postCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    try {
      const post = await createPost(parsed.data);
      return NextResponse.json({ data: post }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json({ error: 'slug 已被占用, 换一个' }, { status: 409 });
      }
      throw e;
    }
  } catch (err) {
    console.error('POST /api/blog failed:', err);
    return NextResponse.json({ error: '创建文章失败' }, { status: 500 });
  }
}
