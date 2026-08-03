/**
 * 经期预测 - Zod 校验 schema
 * API 路由 (server) 与前端表单共用
 */
import { z } from 'zod';

export const predictModeSchema = z.enum(['normal', 'ttc', 'contraception']);

export const cycleCreateSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate 格式应为 YYYY-MM-DD'),
  periodDays: z.number().int().min(1).max(10).default(5),
  notes: z.string().max(500).optional().nullable(),
});
export type CycleCreate = z.infer<typeof cycleCreateSchema>;

export const specialFactorsSchema = z
  .object({
    weightChange: z.boolean().optional(),
    sleepDisorder: z.boolean().optional(),
    hormoneDrugs: z.boolean().optional(),
    recentAbortion: z.boolean().optional(),
  })
  .partial();

export const predictRequestSchema = z.object({
  lmp: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'lmp 格式应为 YYYY-MM-DD')
    .optional(),
  periodDays: z.number().int().min(1).max(10).optional(),
  mode: predictModeSchema.default('normal'),
  pmsDays: z.number().int().min(0).max(14).default(7),
  specialFactors: specialFactorsSchema.optional().default({}),
  chronicConditions: z.array(z.string().max(50)).optional().default([]),
});
export type PredictRequest = z.infer<typeof predictRequestSchema>;
