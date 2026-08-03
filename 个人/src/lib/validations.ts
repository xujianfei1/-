/**
 * Zod 校验 schema
 * 单一来源: API 路由、表单、测试共用
 */
import { z } from 'zod';

export const serviceStatusSchema = z.enum(['online', 'dev', 'plan', 'idea']);
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const serviceCreateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(50),
  description: z.string().min(1, '描述不能为空').max(200),
  url: z.string().url('URL 格式无效').nullable().optional(),
  icon: z.string().default('plus'),
  status: serviceStatusSchema.default('idea'),
  category: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isPublic: z.boolean().default(true),
});

export const serviceUpdateSchema = serviceCreateSchema.partial();

export const linkCreateSchema = z.object({
  name: z.string().min(1).max(50),
  url: z.string().url(),
  icon: z.string().default('link'),
  sortOrder: z.number().int().default(0),
});

export const linkUpdateSchema = linkCreateSchema.partial();

export const registerSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(6, '密码至少 6 位').max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** 改昵称 */
export const updateNameSchema = z.object({
  name: z.string().min(1, '昵称不能为空').max(50, '昵称不能超过 50 字符'),
});

export type ServiceCreate = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;
export type LinkCreate = z.infer<typeof linkCreateSchema>;
export type LinkUpdate = z.infer<typeof linkUpdateSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateNameInput = z.infer<typeof updateNameSchema>;
