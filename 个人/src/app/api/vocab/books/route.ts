/**
 * GET /api/vocab/books - 词书列表 + 进度 (登录)
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getBookSummaries } from '@/server/vocab';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const [books, user] = await Promise.all([
      getBookSummaries(a.session.user.id),
      prisma.user.findUnique({ where: { id: a.session.user.id }, select: { vocabBook: true } }),
    ]);
    return NextResponse.json({ data: { books, current: user?.vocabBook ?? null } });
  } catch (err) {
    console.error('GET /api/vocab/books failed:', err);
    return NextResponse.json({ error: '获取词书失败' }, { status: 500 });
  }
}
