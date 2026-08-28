/**
 * GET    /api/links/[id]  - 获取单个链接 (公开)
 * PUT    /api/links/[id]  - 更新 (仅 admin)
 * DELETE /api/links/[id]  - 删除 (仅 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { linkUpdateSchema } from '@/lib/validations';
import { getLinkById, updateLink, deleteLink } from '@/server/links';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const link = await getLinkById(id);
  if (!link) {
    return NextResponse.json({ error: '链接不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: link });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = linkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const link = await updateLink(id, parsed.data);
    return NextResponse.json({ data: link });
  } catch (err) {
    console.error(`PUT /api/links/${id} failed:`, err);
    return NextResponse.json({ error: '更新链接失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  try {
    await deleteLink(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`DELETE /api/links/${id} failed:`, err);
    return NextResponse.json({ error: '删除链接失败' }, { status: 500 });
  }
}
