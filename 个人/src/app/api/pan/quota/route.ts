/**
 * GET /api/pan/quota
 * 返回 { used, limit } (字节, BigInt 序列化为 string)
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getQuotaUsage, getQuotaLimit } from '@/lib/pan-queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  try {
    const [used, limit] = await Promise.all([getQuotaUsage(session.user.id), getQuotaLimit(session.user.id)]);
    return NextResponse.json({ data: { used: used.toString(), limit: limit.toString() } });
  } catch (e) {
    console.error('quota query failed:', e);
    return NextResponse.json({ error: '查询配额失败' }, { status: 500 });
  }
}