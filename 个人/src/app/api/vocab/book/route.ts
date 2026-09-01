/**
 * PUT /api/vocab/book - 切换当前词书 (登录)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { vocabBookSchema } from '@/lib/vocab-validations';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const body = await req.json();
    const parsed = vocabBookSchema.safeParse(body.book);
    if (!parsed.success) {
      return NextResponse.json({ error: '无效的词书' }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: a.session.user.id },
      data: { vocabBook: parsed.data },
    });
    return NextResponse.json({ data: { book: parsed.data } });
  } catch (err) {
    console.error('PUT /api/vocab/book failed:', err);
    return NextResponse.json({ error: '切换词书失败' }, { status: 500 });
  }
}
