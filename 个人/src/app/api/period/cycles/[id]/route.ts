/**
 * GET    /api/period/cycles/[id]   - 暂未实现 (Flask 端无单条 GET)
 * PUT    /api/period/cycles/[id]   - 暂未实现 (Flask 端无编辑)
 * DELETE /api/period/cycles/[id]   - 删除一条
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { flaskFetch, APIError } from '@/lib/period-client';
import type { Cycle } from '@/lib/period-types';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'cycle id 应为正整数' }, { status: 400 });
  }
  try {
    await flaskFetch<Cycle>(
      `/api/cycles/${id}`,
      { method: 'DELETE' },
      session.user.id,
    );
    return NextResponse.json({ data: { deleted: true } });
  } catch (e) {
    if (e instanceof APIError && e.code === 1 && e.httpStatus === 404) {
      return NextResponse.json({ error: '记录不存在' }, { status: 404 });
    }
    if (e instanceof APIError) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus >= 400 && e.httpStatus < 600 ? e.httpStatus : 500 },
      );
    }
    console.error(`DELETE /api/period/cycles/${id} failed:`, e);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
