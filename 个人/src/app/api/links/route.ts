/**
 * GET  /api/links  - 列出所有快捷链接
 * POST /api/links  - 创建新链接
 */
import { NextResponse, type NextRequest } from 'next/server';
import { linkCreateSchema } from '@/lib/validations';
import { getLinks, createLink } from '@/server/links';

export async function GET() {
  try {
    const links = await getLinks();
    return NextResponse.json({ data: links });
  } catch (err) {
    console.error('GET /api/links failed:', err);
    return NextResponse.json({ error: '获取链接列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = linkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const link = await createLink(parsed.data);
    return NextResponse.json({ data: link }, { status: 201 });
  } catch (err) {
    console.error('POST /api/links failed:', err);
    return NextResponse.json({ error: '创建链接失败' }, { status: 500 });
  }
}
