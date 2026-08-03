/**
 * GET   /api/period/cycles   - 列出当前用户所有周期
 * POST  /api/period/cycles   - 新增一条周期
 *
 * 鉴权: NextAuth session → 取 user.id → 拼 HMAC 头 → 转 Flask
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { flaskFetch, APIError } from '@/lib/period-client';
import { cycleCreateSchema } from '@/lib/period-validations';
import type { Cycle } from '@/lib/period-types';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  try {
    const cycles = await flaskFetch<Cycle[]>(
      '/api/cycles',
      { method: 'GET' },
      session.user.id,
    );
    return NextResponse.json({ data: cycles });
  } catch (e) {
    return proxyError(e, '获取周期列表失败');
  }
}

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = cycleCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const cycle = await flaskFetch<Cycle>(
      '/api/cycles',
      { method: 'POST', body: JSON.stringify(parsed.data) },
      session.user.id,
    );
    return NextResponse.json({ data: cycle }, { status: 201 });
  } catch (e) {
    return proxyError(e, '创建周期失败');
  }
}

function proxyError(e: unknown, fallback: string) {
  if (e instanceof APIError) {
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
    );
  }
  console.error(`${fallback}:`, e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
