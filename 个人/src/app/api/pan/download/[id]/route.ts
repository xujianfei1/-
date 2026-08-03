/**
 * GET /api/pan/download/[id]
 * 流式下载文件. 鉴权后用 storage.get 拿流, 直接 pipe 到 Response.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { Readable } from 'node:stream';
import { requireActiveUser } from '@/lib/auth';
import { getFileForUser, NotFoundError } from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const { id } = await ctx.params;
  const file = await getFileForUser(session.user.id, id);
  if (!file) {
    return NextResponse.json({ error: '文件不存在' }, { status: 404 });
  }
  if (file.isDir || !file.storageKey) {
    return NextResponse.json({ error: '不能下载目录' }, { status: 400 });
  }
  const storage = getStorage();
  let nodeStream: Readable;
  try {
    nodeStream = await storage.get(file.storageKey);
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
    console.error('download: storage get failed:', e);
    return NextResponse.json({ error: '读取文件失败' }, { status: 500 });
  }
  // Node Readable → Web ReadableStream
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  const filenameStar = encodeURIComponent(file.name);
  return new Response(webStream, {
    headers: {
      'Content-Type': file.mimeType ?? 'application/octet-stream',
      'Content-Length': file.size.toString(),
      'Content-Disposition': `attachment; filename*=UTF-8''${filenameStar}`,
      'Cache-Control': 'private, no-cache',
    },
  });
}
