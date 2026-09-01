/**
 * POST /api/vocab/answer - 提交答题, 更新 SM-2 (登录)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { answerSchema } from '@/lib/vocab-validations';
import { recordAnswer } from '@/server/vocab';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const parsed = answerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: '参数无效' }, { status: 400 });
    }
    const { wordId, mode, correct, nearMiss } = parsed.data;
    const result = await recordAnswer(a.session.user.id, wordId, mode, correct, nearMiss);
    if (!result) return NextResponse.json({ error: '单词不存在' }, { status: 404 });
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('POST /api/vocab/answer failed:', err);
    return NextResponse.json({ error: '记录答题失败' }, { status: 500 });
  }
}
