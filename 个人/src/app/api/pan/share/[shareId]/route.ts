/**
 * DELETE /api/pan/share/[shareId]
 * 撤销分享. 只有 owner 能撤.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { revokeShare } from '@/lib/pan-queries';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ shareId: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;
  const { shareId } = await ctx.params;

  const r = await revokeShare(userId, shareId);
  if (r.count === 0) {
    return NextResponse.json({ error: '分享不存在或无权限' }, { status: 404 });
  }

  return NextResponse.json({ data: { id: shareId, revoked: true } });
}
