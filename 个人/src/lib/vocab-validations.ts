/**
 * 背单词校验 (zod)
 */
import { z } from 'zod';

export const VOCAB_BOOKS = ['CET4', 'CET6', 'KAOYAN', 'CUSTOM'] as const;
export type VocabBook = (typeof VOCAB_BOOKS)[number];

export const BOOK_META: Record<VocabBook, { label: string; desc: string }> = {
  CET4: { label: '英语四级', desc: 'CET-4 核心词汇' },
  CET6: { label: '英语六级', desc: 'CET-6 核心词汇' },
  KAOYAN: { label: '考研英语', desc: '考研核心词汇' },
  CUSTOM: { label: '自定义词库', desc: '自己导入的单词' },
};

export const vocabBookSchema = z.enum(VOCAB_BOOKS);

export const answerSchema = z.object({
  wordId: z.string().min(1),
  mode: z.enum(['choice', 'spell']),
  correct: z.boolean(),
  /** 拼写"接近" (词形差异) 时传 true, 记 q=3 */
  nearMiss: z.boolean().optional(),
});

export const importSchema = z.object({
  /** 每行一条: 单词[Tab或空格分隔]释义 */
  text: z.string().min(1, '导入内容不能为空').max(100000),
});

export type VocabAnswer = z.infer<typeof answerSchema>;
