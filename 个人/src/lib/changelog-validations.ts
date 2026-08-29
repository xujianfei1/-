/**
 * 更新日志校验 (zod)
 */
import { z } from 'zod';

export const changelogTypeSchema = z.enum(['feature', 'fix', 'improvement', 'notice']);
export type ChangelogType = z.infer<typeof changelogTypeSchema>;

export const changelogCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题最长 120 字'),
  body: z.string().trim().min(1, '内容不能为空').max(5000, '内容最长 5000 字符'),
  type: changelogTypeSchema.default('feature'),
});

export type ChangelogCreate = z.infer<typeof changelogCreateSchema>;

export const TYPE_META: Record<ChangelogType, { label: string; badge: string }> = {
  feature: { label: '新功能', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  fix: { label: '修复', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  improvement: { label: '优化', badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  notice: { label: '公告', badge: 'bg-accent/10 text-accent' },
};
