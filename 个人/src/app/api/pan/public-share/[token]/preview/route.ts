/**
 * GET /api/pan/public-share/[token]/preview
 * 公开分享的预览接口 (Content-Disposition: inline).
 *
 * - 鉴权:
 *   - 分享无密码: 直接放行
 *   - 分享有密码: 需要 query `?token=<downloadToken>` (从 access 接口获取)
 */
import { type NextRequest, NextResponse } from 'next/server';
import { getShareByToken } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { verifyDownloadToken } from '@/lib/share-token';
import { isPreviewable } from '@/lib/preview';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { token: shareToken } = await ctx.params;
  const share = await getShareByToken(shareToken);
  if (!share) {
    return NextResponse.json({ error: '分享不存在' }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: '分享已过期' }, { status: 410 });
  }
  // 有密码则必须有有效 downloadToken
  if (share.passwordHash) {
    const downloadToken = req.nextUrl.searchParams.get('token');
    if (!downloadToken || !verifyDownloadToken(share.id, downloadToken)) {
      return NextResponse.json({ error: '需要密码或 token 已过期' }, { status: 401 });
    }
  }

  const file = await prisma.file.findUnique({ where: { id: share.fileId } });
  if (!file) {
    return NextResponse.json({ error: '文件已删除' }, { status: 410 });
  }
  if (file.isDir) {
    return NextResponse.json({ error: '文件夹不能预览' }, { status: 400 });
  }
  if (!isPreviewable(file.mimeType, file.name)) {
    return NextResponse.json({ error: '该文件类型不支持预览' }, { status: 415 });
  }
  if (!file.storageKey) {
    return NextResponse.json({ error: '文件元数据异常' }, { status: 500 });
  }

  const storage = getStorage();
  const stream = await storage.get(file.storageKey);

  return new NextResponse(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
    },
  });
}
