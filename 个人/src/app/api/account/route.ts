/**
 * PATCH  /api/account       body: { name }   改昵称 (email 不可改)
 * DELETE /api/account       body: { confirm: "DELETE" }   注销账号 (清数据)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/auth';
import { updateNameSchema } from '@/lib/validations';
import { updateUserName, deleteUserAndData } from '@/server/users';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = updateNameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const user = await updateUserName(auth.userId, parsed.data);
    return NextResponse.json({ data: user });
  } catch (e) {
    console.error('update name failed:', e);
    return NextResponse.json({ error: '改昵称失败' }, { status: 500 });
  }
}

const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE'),
});

export async function DELETE(req: NextRequest) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body (fetch 不到 parse 时), 走 schema 默认 fail
  }
  const parsed = deleteAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '需要 confirm: "DELETE" 才会执行注销' },
      { status: 400 },
    );
  }
  try {
    const result = await deleteUserAndData(auth.userId);
    return NextResponse.json({ data: { deleted: true, filesDeleted: result.filesDeleted } });
  } catch (e) {
    console.error('delete account failed:', e);
    return NextResponse.json({ error: '注销失败' }, { status: 500 });
  }
}
