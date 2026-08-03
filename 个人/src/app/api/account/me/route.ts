/**
 * GET /api/account/me
 * 返回当前登录用户的信息 (用于设置面板)
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, createdAt: true, quotaBytes: true },
  });
  if (!user) {
    return NextResponse.json({ error: '用户不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: user });
}
