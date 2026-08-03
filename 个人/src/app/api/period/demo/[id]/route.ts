/**
 * GET /api/period/demo/[id] - 公共示例 (无需登录)
 * Flask 端 /api/demo/* 不需要 HMAC, 这里也不做 auth 检查
 */
import { NextResponse, type NextRequest } from 'next/server';
import { flaskFetch, APIError } from '@/lib/period-client';
import type { DemoCaseResponse } from '@/lib/period-types';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!/^[1-3]$/.test(id)) {
    return NextResponse.json({ error: '案例不存在' }, { status: 404 });
  }
  try {
    const data = await flaskFetch<DemoCaseResponse>(
      `/api/demo/${id}`,
      { method: 'GET' },
      'demo-anon',
    );
    return NextResponse.json({ data });
  } catch (e) {
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
      );
    }
    console.error(`GET /api/period/demo/${id} failed:`, e);
    return NextResponse.json({ error: '示例加载失败' }, { status: 500 });
  }
}
