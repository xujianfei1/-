/**
 * 背单词业务层 (Server-only)
 */
import 'server-only';
import { prisma } from '@/lib/prisma';
import { reviewSm2, judgeSpell, type SrsState } from '@/lib/srs';
import type { VocabBook } from '@/lib/vocab-validations';

/** 每日新词量 */
export const DAILY_NEW = 10;

/** 词书列表 + 该用户在各书的进度 */
export async function getBookSummaries(userId: string) {
  const books = ['CET4', 'CET6', 'KAOYAN', 'CUSTOM'] as const;
  const now = new Date();
  const todayEnd = new Date(now.getTime() + 24 * 3600 * 1000);

  return Promise.all(
    books.map(async (book) => {
      const total = await prisma.word.count({
        where: book === 'CUSTOM' ? { book: 'CUSTOM', ownerId: userId } : { book: { contains: book } },
      });
      const learned = await prisma.vocabProgress.count({
        where: { userId, word: book === 'CUSTOM' ? { ownerId: userId } : { book: { contains: book } } },
      });
      const due = await prisma.vocabProgress.count({
        where: {
          userId,
          dueAt: { lte: todayEnd },
          word: book === 'CUSTOM' ? { ownerId: userId } : { book: { contains: book } },
        },
      });
      return { book, total, learned, due };
    }),
  );
}

/** 生成今日学习队列: 到期复习优先 + 补新词, 每词附四选一干扰项 */
export async function buildSession(userId: string, book: VocabBook, size = 10) {
  const bookWhere = book === 'CUSTOM' ? { ownerId: userId } : { book: { contains: book } };
  const now = new Date();
  const todayEnd = new Date(now.getTime() + 24 * 3600 * 1000);

  // 1) 到期复习 (含今天到期), 按到期时间升序
  const dueRoster = await prisma.vocabProgress.findMany({
    where: { userId, dueAt: { lte: todayEnd }, word: bookWhere },
    orderBy: { dueAt: 'asc' },
    take: size,
    include: { word: true },
  });

  // 2) 补新词 (没有任何进度的)
  let newRoster: { word: typeof dueRoster[number]['word'] }[] = [];
  const need = size - dueRoster.length;
  if (need > 0) {
    const learnedIds = (
      await prisma.vocabProgress.findMany({ where: { userId }, select: { wordId: true } })
    ).map((p) => p.wordId);
    const fresh = await prisma.word.findMany({
      where: { ...bookWhere, id: { notIn: learnedIds } },
      orderBy: { word: 'asc' },
      take: need,
    });
    newRoster = fresh.map((word) => ({ word }));
  }

  const roster = [
    ...dueRoster.map((p) => ({ word: p.word, isNew: false, progress: p })),
    ...newRoster.map((n) => ({ word: n.word, isNew: true, progress: null })),
  ];

  // 3) 每词抽 3 个同书干扰项
  const pool = await prisma.word.findMany({
    where: bookWhere,
    select: { id: true, word: true, definition: true },
    take: 800,
  });
  const items = roster.map(({ word, isNew }) => {
    const distractors = pool
      .filter((p) => p.id !== word.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((p) => ({ id: p.id, word: p.word, definition: p.definition.split('\n')[0] }));
    return {
      wordId: word.id,
      word: word.word,
      phonetic: word.phonetic,
      definition: word.definition,
      example: word.example,
      exampleTrans: word.exampleTrans,
      isNew,
      choices: [...distractors, { id: word.id, word: word.word, definition: word.definition.split('\n')[0] }].sort(
        () => Math.random() - 0.5,
      ),
    };
  });

  return items;
}

/** 记录一次答题: 选择题按对错, 拼写走 judgeSpell, 均更新 SM-2 */
export async function recordAnswer(
  userId: string,
  wordId: string,
  mode: 'choice' | 'spell',
  correct: boolean,
  nearMiss?: boolean,
) {
  const word = await prisma.word.findUnique({ where: { id: wordId }, select: { id: true, word: true } });
  if (!word) return null;

  let quality: number;
  if (mode === 'spell' && correct && nearMiss) {
    quality = judgeSpell('__near__', word.word).quality; // 3
    // 直接按 near 判定
    quality = 3;
  } else {
    quality = correct ? 5 : mode === 'spell' ? 1 : 2;
  }

  const existing = await prisma.vocabProgress.findUnique({
    where: { userId_wordId: { userId, wordId } },
  });
  const state: SrsState = existing
    ? { easeFactor: existing.easeFactor, intervalDays: existing.intervalDays, repetitions: existing.repetitions }
    : { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

  const next = reviewSm2(state, quality);
  const data = {
    easeFactor: next.easeFactor,
    intervalDays: next.intervalDays,
    repetitions: next.repetitions,
    dueAt: next.dueAt,
    lastQuality: quality,
  };

  const progress = existing
    ? await prisma.vocabProgress.update({ where: { id: existing.id }, data })
    : await prisma.vocabProgress.create({ data: { userId, wordId, ...data } });

  return { quality, ...next };
}

/** 总览统计 (含连续打卡天数) */
export async function getStats(userId: string) {
  const now = new Date();
  const todayEnd = new Date(now.getTime() + 24 * 3600 * 1000);
  const [learned, due, streak] = await Promise.all([
    prisma.vocabProgress.count({ where: { userId } }),
    prisma.vocabProgress.count({ where: { userId, dueAt: { lte: todayEnd } } }),
    calcStreak(userId),
  ]);
  return { learned, due, streak, dailyNew: DAILY_NEW };
}

/** 连续打卡: 连续 N 天(截至今天)每天都有 learning 动作 */
async function calcStreak(userId: string): Promise<number> {
  const progress = await prisma.vocabProgress.findMany({
    where: { userId },
    select: { updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });
  const days = new Set(progress.map((p) => p.updatedAt.toDateString()));
  let streak = 0;
  const cur = new Date();
  // 今天没学不打断连续 (从昨天起算), 学了则从今天起算
  if (!days.has(cur.toDateString())) cur.setDate(cur.getDate() - 1);
  while (days.has(cur.toDateString())) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/** 自定义导入: "word 释义" 每行一条, 进 CUSTOM 书 */
export async function importWords(userId: string, text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const seen = new Map<string, string>();
  for (const line of lines) {
    const m = line.match(/^([a-zA-Z][a-zA-Z'-]{0,40})[\t\s]+(.+)$/);
    if (!m) continue;
    const word = m[1]!.toLowerCase();
    if (!seen.has(word)) seen.set(word, m[2]!.trim().slice(0, 500));
  }
  let imported = 0;
  for (const [word, definition] of seen) {
    const w = await prisma.word.upsert({
      where: { word },
      create: { word, definition, book: 'CUSTOM', ownerId: userId },
      update: {}, // 已有全局词则不覆盖
    });
    if (w.book.includes('CUSTOM') && w.ownerId === userId) imported++;
  }
  return { parsed: seen.size, imported };
}
