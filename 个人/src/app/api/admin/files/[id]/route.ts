/**
 * DELETE /api/admin/files/[id]   admin 递归删任意文件
 *
 * 鉴权: requireAdmin
 * 审计: 写 AdminAuditLog (delete_file)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { deleteRecursive, getFileAsAdmin } from '@/lib/pan-queries';
import { logAdminAction } from '@/server/audit';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  // 先快照目标信息 (audit 用), 再删
  const target = await getFileAsAdmin(id);
  try {
    await deleteRecursive(auth.session.user.id, id, { asAdmin: true });
    await logAdminAction({
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
      action: 'delete_file',
      targetId: id,
      targetLabel: target?.name ?? null,
      meta: {
        isDir: target?.isDir ?? false,
        size: target ? target.size.toString() : null,
        ownerId: target?.ownerId ?? null,
        isShared: target?.isShared ?? false,
      },
      req,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('admin delete file failed:', e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}