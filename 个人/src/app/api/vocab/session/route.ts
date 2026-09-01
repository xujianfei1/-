/**
 * GET /api/vocab/session?size=10 - 生成今日学习队列 (登录; 未选词书 400)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { buildSession } from '@/server/vocab';
import { VOCAB_BOOKS, type VocabBook } from '@/lib/vocab-validations';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const user = await prisma.user.findUnique({ where: { id: a.session.user.id }, select: { vocabBook: true } });
    const book = user?.vocabBook as VocabBook | null;
    if (!book || !VOCAB_BOOKS.includes(book)) {
      return NextResponse.json({ error: '请先选择词书' }, { status: 400 });
    }
    const size = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('size')) || 10));
    const items = await buildSession(a.session.user.id, book, size);
    return NextResponse.json({ data: { book, items } });
  } catch (err) {
    console.error('GET /api/vocab/session failed:', err);
    return NextResponse.json({ error: '生成学习队列失败' }, { status: 500 });
  }
}
