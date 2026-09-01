/**
 * POST /api/vocab/import - 自定义导入 (登录)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { importSchema } from '@/lib/vocab-validations';
import { importWords } from '@/server/vocab';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const parsed = importSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors.text?.[0] ?? '参数无效' }, { status: 400 });
    }
    const result = await importWords(a.session.user.id, parsed.data.text);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('POST /api/vocab/import failed:', err);
    return NextResponse.json({ error: '导入失败' }, { status: 500 });
  }
}
