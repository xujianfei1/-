/**
 * GET /api/pan/share/[token]
 * 公开访问分享: 返回 share 的展示信息 (文件名/大小/是否需要密码)
 * 不返回 owner / 真实路径, 避免信息泄露.
 *
 * Query:
 *   - tree=1: 文件夹时同时返回直接子项 (用于公开页面预览), 不递归
 *
 * Response: { data: { fileName, fileSize, isDir, hasPassword, allowDownload, expiresAt, children? } }
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getShareByToken } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const share = await getShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: '分享不存在' }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: '分享已过期' }, { status: 410 });
  }

  // 拉 file 元数据
  const file = await prisma.file.findUnique({
    where: { id: share.fileId },
    select: { name: true, size: true, isDir: true, mimeType: true },
  });
  if (!file) {
    return NextResponse.json({ error: '文件已删除' }, { status: 410 });
  }

  const data: Record<string, unknown> = {
    fileName: file.name,
    fileSize: file.size.toString(),
    isDir: file.isDir,
    mimeType: file.mimeType,
    hasPassword: !!share.passwordHash,
    allowDownload: share.allowDownload,
    expiresAt: share.expiresAt?.toISOString() ?? null,
  };

  // 文件夹且 tree=1: 列出直接子项 (顶层预览, 不递归)
  const wantTree = req.nextUrl.searchParams.get('tree') === '1';
  if (wantTree && file.isDir) {
    const children = await prisma.file.findMany({
      where: { parentId: share.fileId },
      orderBy: [{ isDir: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, size: true, isDir: true },
    });
    data.children = children.map((c) => ({
      id: c.id,
      name: c.name,
      size: c.size.toString(),
      isDir: c.isDir,
    }));
  }

  return NextResponse.json({ data });
}
