/**
 * 云盘 API 入参验证 (zod)
 */
import { z } from 'zod';

/** 文件/文件夹名: 1-255 字符, 不允许路径分隔符、空名、保留名 */
export const fileNameSchema = z
  .string()
  .min(1, 'name is required')
  .max(255, 'name too long')
  .refine((n) => !n.includes('/') && !n.includes('\\'), 'name cannot contain / or \\')
  .refine((n) => n !== '.' && n !== '..', 'name cannot be . or ..')
  .refine((n) => !/^\s|\s$/.test(n), 'name cannot start or end with whitespace');

/** 列表 scope */
export const listScopeSchema = z.enum(['private', 'shared']).default('private');

/** parentId: cuid 或 null (根). 接受空字符串视为 null. */
export const parentIdSchema = z
  .preprocess((v) => (v === '' || v === undefined ? null : v), z.string().cuid().nullable())
  .default(null);

/** GET /api/pan/files?parentId=...&scope=...&q=... */
export const listFilesQuerySchema = z.object({
  parentId: parentIdSchema,
  scope: listScopeSchema,
  /** 按 name 模糊搜 (LIKE %q%), 仅当前目录 */
  q: z.string().min(1).max(100).optional(),
});

/** POST /api/pan/files (创建文件夹) */
export const createFolderSchema = z.object({
  name: fileNameSchema,
  parentId: parentIdSchema,
  isShared: z.boolean().default(false),
});

/** PATCH /api/pan/files/[id] (重命名 / 移动) */
export const updateFileSchema = z.object({
  name: fileNameSchema.optional(),
  parentId: parentIdSchema.optional(),
});

/** 移动文件 (含移动到根/子目录) — 单独 schema 防止误改 parentId */
export const moveFileSchema = z.object({
  parentId: parentIdSchema,
});

/** multipart upload 字段 (随 FormData 一起) */
export const uploadMetaSchema = z.object({
  parentId: parentIdSchema,
  isShared: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((v) => v === 'true' || v === '1'),
  /** 文件名 (可选, 缺省用 multipart filename) */
  name: fileNameSchema.optional(),
});

/**
 * 分块上传 (M2) — start body
 *   name:      最终文件名
 *   fileSize:  原始文件总字节
 *   mimeType:  可选
 *   chunkSize: 可选, 默认 5MB (5*1024*1024), 服务端会四舍五入到 1MB
 *   parentId / isShared: 与单次上传一致
 */
export const chunkedStartSchema = z.object({
  name: fileNameSchema,
  fileSize: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024 * 1024, '单文件最大 10GB'), // M2 上限
  mimeType: z.string().max(255).optional(),
  chunkSize: z.number().int().min(1024 * 1024).max(50 * 1024 * 1024).optional(),
  parentId: parentIdSchema,
  isShared: z.boolean().default(false),
  /// true: 上传的是 zip 压缩包, complete 时解压到 parentId 下
  isZip: z.boolean().default(false),
});

export type ChunkedStartInput = z.infer<typeof chunkedStartSchema>;

export type ListFilesQuery = z.infer<typeof listFilesQuerySchema>;
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
export type MoveFileInput = z.infer<typeof moveFileSchema>;
export type UploadMeta = z.infer<typeof uploadMetaSchema>;

/** 创建分享 POST /api/pan/share */
export const createShareSchema = z.object({
  fileId: z.string().cuid(),
  password: z.string().min(1).max(128).optional(),
  expiresAt: z
    .preprocess((v) => (v === '' || v === undefined ? null : v), z.string().datetime().nullable())
    .default(null),
  allowDownload: z.boolean().default(true),
});

/** 公开访问分享页 POST (验证密码) — 复用 csrf-free password check */
export const shareAccessSchema = z.object({
  password: z.string().min(1).max(128).optional(),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type ShareAccessInput = z.infer<typeof shareAccessSchema>;
