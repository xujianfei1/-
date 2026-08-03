/**
 * GET    /api/services   - 列出所有服务
 * POST   /api/services   - 创建新服务
 *
 * 鉴权: 当前默认公开, 后续可在 src/server/services.ts 加 auth 检查
 */
import { NextResponse, type NextRequest } from 'next/server';
import { serviceCreateSchema } from '@/lib/validations';
import { getServices, createService } from '@/server/services';

export async function GET() {
  try {
    const services = await getServices();
    return NextResponse.json({ data: services });
  } catch (err) {
    console.error('GET /api/services failed:', err);
    return NextResponse.json({ error: '获取服务列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = serviceCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const service = await createService(parsed.data);
    return NextResponse.json({ data: service }, { status: 201 });
  } catch (err) {
    console.error('POST /api/services failed:', err);
    return NextResponse.json({ error: '创建服务失败' }, { status: 500 });
  }
}
