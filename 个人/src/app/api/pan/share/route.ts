/**
 * POST /api/pan/share
 * Body: { fileId, password?, expiresAt?, allowDownload? }
 * Response: { data: { id, token, url, ... } }
 *
 * 鉴权: 必须是 file 的 owner; 共享池 file 任意登录用户可分享.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  getFileForUser,
  createShare,
} from '@/lib/pan-queries';
import { createShareSchema } from '@/lib/pan-validations';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = createShareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 鉴权: 必须是 owner 或共享池 file
  const file = await getFileForUser(userId, parsed.data.fileId);
  if (!file) {
    return NextResponse.json({ error: '文件不存在或无权限' }, { status: 404 });
  }

  // password hash
  let passwordHash: string | null = null;
  if (parsed.data.password && parsed.data.password.length > 0) {
    passwordHash = await bcrypt.hash(parsed.data.password, 10);
  }

  const share = await createShare(userId, {
    fileId: parsed.data.fileId,
    passwordHash,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    allowDownload: parsed.data.allowDownload,
  });

  return NextResponse.json(
    {
      data: {
        id: share.id,
        token: share.token,
        url: `/share/${share.token}`,
        fileId: share.fileId,
        allowDownload: share.allowDownload,
        hasPassword: !!share.passwordHash,
        expiresAt: share.expiresAt?.toISOString() ?? null,
        createdAt: share.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
