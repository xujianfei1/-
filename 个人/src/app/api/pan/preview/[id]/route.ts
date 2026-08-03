/**
 * GET /api/pan/preview/[id]
 * 在线预览 (Content-Disposition: inline).
 * - 鉴权: 必须是 owner, 或共享池文件 (isShared=true)
 * - 区别于 /download 的地方: 这里 inline 触发浏览器内置查看器
 *   (图片直接显示, PDF 走浏览器 PDF viewer)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getFileForUser } from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';
import { isPreviewable } from '@/lib/preview';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;
  const { id } = await ctx.params;

  const file = await getFileForUser(userId, id);
  if (!file) {
    return NextResponse.json({ error: '文件不存在或无权限' }, { status: 404 });
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
