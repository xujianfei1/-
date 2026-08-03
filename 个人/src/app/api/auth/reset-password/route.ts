/**
 * POST /api/auth/reset-password
 * body: { token: string, newPassword: string }
 *
 * 安全要点:
 *   - token 长度 = 64 hex chars (32 bytes * 2)
 *   - DB 查 hash(plain) + 未过期
 *   - 找不到 → 401 (链接无效或已过期)
 *   - 用完清字段 (一次性)
 *   - 写 passwordChangedAt, 旧 JWT 自动失效 (auth.ts jwt callback 校验)
 *   - rate-limit by IP (10/h)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { check, getClientIp } from '@/lib/rate-limit';
import { hashResetToken } from '@/lib/password-reset';

const schema = z.object({
  token: z.string().min(64).max(64),
  newPassword: z.string().min(6).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效, 请检查链接是否完整' },
        { status: 400 },
      );
    }
    const { token, newPassword } = parsed.data;

    // rate-limit by IP
    const ip = getClientIp(req);
    const ipCheck = check(`reset-pw:ip:${ip}`, 10, 60 * 60 * 1000);
    if (!ipCheck.ok) {
      return NextResponse.json(
        { error: `请求过于频繁, 请 ${ipCheck.retryAfterSec} 秒后再试` },
        { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec) } },
      );
    }

    const tokenHash = hashResetToken(token);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: tokenHash,
        passwordResetExpires: { gt: new Date() },
      },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: '链接无效或已过期, 请重新申请' },
        { status: 401 },
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: now,
        // 清 token (一次性)
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    console.log(`[reset-password] user ${user.email} password reset at ${now.toISOString()}`);

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error('[reset-password] error:', err);
    return NextResponse.json(
      { error: '重置失败, 请稍后再试' },
      { status: 500 },
    );
  }
}
