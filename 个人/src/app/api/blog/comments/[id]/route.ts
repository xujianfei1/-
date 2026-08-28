/**
 * DELETE /api/blog/comments/[id]  - 删除评论 (本人或 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getCommentById, deleteComment } from '@/server/posts';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const { id } = await ctx.params;
    const comment = await getCommentById(id);
    if (!comment) return NextResponse.json({ error: '评论不存在' }, { status: 404 });

    const isOwner = comment.userId === a.session.user.id;
    if (!isOwner && !a.session.user.isAdmin) {
      return NextResponse.json({ error: '只能删除自己的评论' }, { status: 403 });
    }

    await deleteComment(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE comment failed:', err);
    return NextResponse.json({ error: '删除评论失败' }, { status: 500 });
  }
}
