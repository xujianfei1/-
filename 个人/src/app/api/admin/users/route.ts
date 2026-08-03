/**
 * GET /api/admin/users
 * 列出所有用户 + 各自统计 (admin 用).
 * 鉴权: requireAdmin
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listUsersWithStats } from '@/lib/pan-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const users = await listUsersWithStats();
    return NextResponse.json({ data: users });
  } catch (e) {
    console.error('admin list users failed:', e);
    return NextResponse.json({ error: '获取用户列表失败' }, { status: 500 });
  }
}