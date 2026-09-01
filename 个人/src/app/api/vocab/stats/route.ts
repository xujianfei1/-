/**
 * GET /api/vocab/stats - 总览统计 (登录)
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getStats } from '@/server/vocab';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    return NextResponse.json({ data: await getStats(a.session.user.id) });
  } catch (err) {
    console.error('GET /api/vocab/stats failed:', err);
    return NextResponse.json({ error: '获取统计失败' }, { status: 500 });
  }
}
