/**
 * POST /api/period/predict - 预测经期
 * 入参透传到 Flask, Flask 端会从数据库读历史
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { flaskFetch, APIError } from '@/lib/period-client';
import { predictRequestSchema } from '@/lib/period-validations';
import type { PredictionResult } from '@/lib/period-types';

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = predictRequestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const result = await flaskFetch<PredictionResult>(
      '/api/period/predict',
      { method: 'POST', body: JSON.stringify(parsed.data) },
      session.user.id,
    );
    return NextResponse.json({ data: result });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
      );
    }
    console.error('POST /api/period/predict failed:', e);
    return NextResponse.json({ error: '预测失败' }, { status: 500 });
  }
}
