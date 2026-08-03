/**
 * POST /api/auth/forgot-password
 * body: { email: string }
 *
 * 安全要点:
 *   - rate-limit by IP (5/h) + by email (3/h)
 *   - 总是 200 + 同样 body (防邮箱枚举)
 *   - 邮箱不存在时 800ms 恒定延迟再返
 *   - token 256 bit, DB 存 hash, 邮件发原文
 *   - 1h 过期
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { check, getClientIp } from '@/lib/rate-limit';
import { generateResetToken, hashResetToken, RESET_EXPIRES_MS } from '@/lib/password-reset';
import { sendPasswordResetEmail, isMockMode } from '@/lib/email';

const schema = z.object({ email: z.string().email().max(254) });

// 防枚举: 邮箱不存在也 800ms
const ENUMERATION_DELAY_MS = 800;

function appBaseUrl(req: NextRequest): string {
  // 优先用 env 配的, 否则用请求 host
  const fromEnv = process.env.NEXTAUTH_URL ?? process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'xujianfei.cn';
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '请输入有效的邮箱地址' },
        { status: 400 },
      );
    }
    const email = parsed.data.email.toLowerCase().trim();

    // rate-limit by IP
    const ip = getClientIp(req);
    const ipCheck = check(`forgot-pw:ip:${ip}`, 5, 60 * 60 * 1000);
    if (!ipCheck.ok) {
      return NextResponse.json(
        { error: `请求过于频繁, 请 ${ipCheck.retryAfterSec} 秒后再试` },
        {
          status: 429,
          headers: { 'Retry-After': String(ipCheck.retryAfterSec) },
        },
      );
    }
    // rate-limit by email
    const emailCheck = check(`forgot-pw:email:${email}`, 3, 60 * 60 * 1000);
    if (!emailCheck.ok) {
      return NextResponse.json(
        { error: '该邮箱请求次数过多, 请稍后再试' },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, banned: true },
    });

    if (!user || user.banned) {
      // 不存在 / 被封禁 — 假装处理, 800ms 恒定延迟
      await new Promise((r) => setTimeout(r, ENUMERATION_DELAY_MS));
      return NextResponse.json({ data: { sent: true } });
    }

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const expires = new Date(Date.now() + RESET_EXPIRES_MS);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpires: expires },
    });

    const base = appBaseUrl(req);
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const serverNow = new Date().toISOString();

    const send = await sendPasswordResetEmail({ to: email, resetUrl, serverNow });
    if (!send.ok) {
      console.error('[forgot-password] send failed:', send.error);
      // 即便发送失败, 也返 200 (防枚举) 但记录日志
    }

    if (isMockMode()) {
      console.log(`[forgot-password] MOCK MODE — 真实 AccessKey 配齐后会真发邮件. 重置链接: ${resetUrl}`);
    }

    return NextResponse.json({ data: { sent: true } });
  } catch (err) {
    console.error('[forgot-password] error:', err);
    // 兜底也返 200, 防错误信息暴露内部状态
    return NextResponse.json({ data: { sent: true } });
  }
}
