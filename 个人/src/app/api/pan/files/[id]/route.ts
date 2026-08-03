/**
 * PATCH  /api/pan/files/[id]  body: { name?, parentId? }
 * DELETE /api/pan/files/[id]  递归删
 *
 * Next.js 15: ctx.params 是 Promise, 必须 await
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { renameFile, moveFile, deleteRecursive, ForbiddenError, NotFoundError } from '@/lib/pan-queries';
import { updateFileSchema } from '@/lib/pan-validations';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = updateFileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数无效', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    if (parsed.data.name) {
      await renameFile(session.user.id, id, parsed.data.name);
    }
    if (parsed.data.parentId !== undefined) {
      await moveFile(session.user.id, id, parsed.data.parentId);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error('update file failed:', e);
    return NextResponse.json({ error: '更新文件失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const { id } = await ctx.params;
  try {
    await deleteRecursive(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error('delete file failed:', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
