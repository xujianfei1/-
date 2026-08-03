/**
 * GET /api/pan/shares
 * 列出当前用户创建的所有分享
 * Response: { data: [{ id, token, url, fileId, fileName, allowDownload, hasPassword, expiresAt, accessCount, lastAccessedAt, createdAt }] }
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { listMyShares } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;

  const shares = await listMyShares(userId);
  // 拉取对应 file 的 name + mimeType 用于显示
  const fileIds = [...new Set(shares.map((s) => s.fileId))];
  const files = await prisma.file.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, name: true, isDir: true, size: true, mimeType: true },
  });
  const fileMap = new Map(files.map((f) => [f.id, f]));

  const data = shares.map((s) => {
    const f = fileMap.get(s.fileId);
    return {
      id: s.id,
      token: s.token,
      url: `/share/${s.token}`,
      fileId: s.fileId,
      fileName: f?.name ?? '(已删除)',
      isDir: f?.isDir ?? false,
      size: f?.size.toString() ?? '0',
      mimeType: f?.mimeType ?? null,
      allowDownload: s.allowDownload,
      hasPassword: !!s.passwordHash,
      expiresAt: s.expiresAt?.toISOString() ?? null,
      accessCount: s.accessCount,
      lastAccessedAt: s.lastAccessedAt?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return NextResponse.json({ data });
}
