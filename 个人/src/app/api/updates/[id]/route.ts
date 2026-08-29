/**
 * DELETE /api/updates/[id]  - 删除更新公告 (仅 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteChangelog } from '@/server/changelogs';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const { id } = await ctx.params;
    await deleteChangelog(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/updates failed:', err);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
