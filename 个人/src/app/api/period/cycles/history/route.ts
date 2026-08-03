/**
 * GET /api/period/cycles/history - 仅返回历史首日数组 (供前端展示)
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { flaskFetch, APIError } from '@/lib/period-client';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  try {
    const dates = await flaskFetch<string[]>(
      '/api/cycles/history',
      { method: 'GET' },
      session.user.id,
    );
    return NextResponse.json({ data: dates });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
      );
    }
    console.error('GET /api/period/cycles/history failed:', e);
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 });
  }
}
