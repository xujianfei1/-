/**
 * Admin 操作审计
 *
 * 不抛错, 失败只 console.error, 不阻塞业务.
 */
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/rate-limit';

export type AuditAction =
  | 'ban_user'
  | 'unban_user'
  | 'delete_user'
  | 'delete_file'
  | 'grant_admin';

export interface AuditInput {
  actorId: string;
  actorEmail?: string | null;
  action: AuditAction;
  targetId?: string | null;
  targetLabel?: string | null;
  meta?: Record<string, unknown>;
  req?: Request;
}

export async function logAdminAction(input: AuditInput): Promise<void> {
  try {
    const ip = input.req ? getClientIp(input.req) : undefined;
    await prisma.adminAuditLog.create({
      data: {
        actorId: input.actorId,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetId: input.targetId ?? null,
        targetLabel: input.targetLabel ?? null,
        meta: input.meta ? JSON.stringify(input.meta) : null,
        ip: ip ?? null,
      },
    });
  } catch (e) {
    // 不抛错, 不阻塞业务
    console.error('audit log write failed:', e);
  }
}