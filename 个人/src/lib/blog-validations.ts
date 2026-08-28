/**
 * 博客文章校验 (zod)
 * API 路由与后台编辑器表单共用
 */
import { z } from 'zod';

export const postStatusSchema = z.enum(['draft', 'published']);
export type PostStatus = z.infer<typeof postStatusSchema>;

/** slug: 小写字母/数字/连字符, 不以连字符开头结尾 */
export const postSlugSchema = z
  .string()
  .min(1, 'slug 不能为空')
  .max(80, 'slug 最长 80 字符')
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'slug 只能含小写字母、数字和连字符, 且不以连字符开头结尾');

export const postCreateSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(120, '标题最长 120 字'),
  slug: postSlugSchema,
  summary: z.string().max(200, '摘要最长 200 字').nullable().optional(),
  content: z.string().min(1, '正文不能为空').max(50000, '正文最长 50000 字符'),
  /** 逗号分隔标签, 如 "next.js,部署" */
  tags: z.string().max(200, '标签最长 200 字符').nullable().optional(),
  status: postStatusSchema.default('draft'),
});

export const postUpdateSchema = postCreateSchema.partial();

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, '评论不能为空').max(1000, '评论最长 1000 字'),
});

export type CommentCreate = z.infer<typeof commentCreateSchema>;

export type PostCreate = z.infer<typeof postCreateSchema>;
export type PostUpdate = z.infer<typeof postUpdateSchema>;

/**
 * 标题转 slug: 小写化 + 空白转连字符 + 去非法字符.
 * 纯中文标题会得到空串, 调用方需兜底 (编辑器用 post-随机串).
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
