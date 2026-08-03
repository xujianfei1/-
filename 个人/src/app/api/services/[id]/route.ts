/**
 * GET    /api/services/[id]  - 获取单个服务
 * PUT    /api/services/[id]  - 更新
 * DELETE /api/services/[id]  - 删除
 */
import { NextResponse, type NextRequest } from 'next/server';
import { serviceUpdateSchema } from '@/lib/validations';
import { getServiceById, updateService, deleteService } from '@/server/services';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const service = await getServiceById(id);
  if (!service) {
    return NextResponse.json({ error: '服务不存在' }, { status: 404 });
  }
  return NextResponse.json({ data: service });
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const parsed = serviceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const service = await updateService(id, parsed.data);
    return NextResponse.json({ data: service });
  } catch (err) {
    console.error(`PUT /api/services/${id} failed:`, err);
    return NextResponse.json({ error: '更新服务失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  try {
    await deleteService(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`DELETE /api/services/${id} failed:`, err);
    return NextResponse.json({ error: '删除服务失败' }, { status: 500 });
  }
}
