/**
 * GET /api/period/annual-stats?year=YYYY - 年度统计
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { flaskFetch, APIError } from '@/lib/period-client';
import type { AnnualStats } from '@/lib/period-types';

export async function GET(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const year = req.nextUrl.searchParams.get('year');
  const qs = year ? `?year=${encodeURIComponent(year)}` : '';
  try {
    const stats = await flaskFetch<AnnualStats>(
      `/api/period/annual-stats${qs}`,
      { method: 'GET' },
      session.user.id,
    );
    return NextResponse.json({ data: stats });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
      );
    }
    console.error('GET /api/period/annual-stats failed:', e);
    return NextResponse.json({ error: '获取年度统计失败' }, { status: 500 });
  }
}
