/**
 * PATCH  /api/admin/users/[id]/ban   body: { banned: boolean }
 * DELETE /api/admin/users/[id]       注销账号 (清数据, 复用 deleteUserAndData)
 *
 * 鉴权: requireAdmin
 * 审计: 写 AdminAuditLog (ban_user / unban_user / delete_user)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { setUserBanned, deleteUserAndData } from '@/server/users';
import { logAdminAction } from '@/server/audit';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const banSchema = z.object({
  banned: z.boolean(),
});

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数无效', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await setUserBanned(id, parsed.data.banned);
    // 取目标用户 email 写到 audit log
    const target = await import('@/lib/prisma').then((m) =>
      m.prisma.user.findUnique({ where: { id }, select: { email: true } }),
    );
    await logAdminAction({
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
      action: parsed.data.banned ? 'ban_user' : 'unban_user',
      targetId: id,
      targetLabel: target?.email ?? null,
      req,
    });
    return NextResponse.json({ data: result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg.includes('锁死')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('ban toggle failed:', e);
    return NextResponse.json({ error: '封禁状态切换失败' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;
  if (id === auth.session.user.id) {
    return NextResponse.json({ error: '不能注销自己 (admin), 请用账号设置里的注销' }, { status: 400 });
  }
  // 先快照目标信息 (audit 用), 再删
  const target = await import('@/lib/prisma').then((m) =>
    m.prisma.user.findUnique({
      where: { id },
      select: { email: true, name: true },
    }),
  );
  try {
    const result = await deleteUserAndData(id);
    await logAdminAction({
      actorId: auth.session.user.id,
      actorEmail: auth.session.user.email,
      action: 'delete_user',
      targetId: id,
      targetLabel: target?.email ?? null,
      meta: { filesDeleted: result.filesDeleted, name: target?.name ?? null },
      req,
    });
    return NextResponse.json({ data: { deleted: true, ...result } });
  } catch (e) {
    console.error('admin delete user failed:', e);
    return NextResponse.json({ error: '注销失败' }, { status: 500 });
  }
}