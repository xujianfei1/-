/**
 * POST /api/pan/upload/[uploadId]/direct/refresh
 * 续传前置: 客户端拿到现有 session 准备接着传, 调这个.
 *
 * Response: { data: {
 *   uploadId, fileKey, partSize, totalParts,
 *   received: [{ partNumber, etag }],          // OSS 已有的 part
 *   missing: [{ partNumber, putUrl }],         // 还没传的 part + 新签名 URL
 * } }
 *
 * 客户端用 received 跳过, 用 missing 接着 PUT, 完成后调 /direct/complete
 * 传完整 parts 列表 (含 received 里的 etag).
 *
 * 适用 direct 模式; proxy 模式 (chunked) 走老路径, 不调这个.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { getSessionForUser } from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const URL_EXPIRES = 1800; // 30 min

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;
  const { uploadId } = await ctx.params;

  const s = await getSessionForUser(userId, uploadId);
  if (!s) {
    return NextResponse.json({ error: '上传会话不存在' }, { status: 404 });
  }
  if (s.status === 'completed') {
    return NextResponse.json({ error: '会话已完成, 无需续传' }, { status: 409 });
  }
  if (s.status === 'aborted') {
    return NextResponse.json({ error: '会话已取消, 不能续传' }, { status: 409 });
  }
  if (s.mode !== 'direct' || !s.ossUploadId || !s.ossKey) {
    return NextResponse.json(
      { error: '该会话不是直传模式, 不支持 refresh' },
      { status: 400 },
    );
  }

  const storage = getStorage();
  // 查 OSS 已有的 part
  let received: Array<{ partNumber: number; etag: string }> = [];
  try {
    const parts = await storage.listMultipartParts(s.ossKey, s.ossUploadId);
    received = parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
  } catch (e) {
    console.warn('direct/refresh: listMultipartParts failed:', e);
    // uploadId 在 OSS 上找不到 (已 abort?), 当作 0 received
  }
  const receivedSet = new Set(received.map((p) => p.partNumber));

  // 还没传的 part 重新签 PUT URL
  const missing: Array<{ partNumber: number; putUrl: string }> = [];
  for (let i = 1; i <= s.totalChunks; i++) {
    if (receivedSet.has(i)) continue;
    const putUrl = await storage.createPresignedPutUrl(s.ossKey, s.ossUploadId, i, URL_EXPIRES);
    missing.push({ partNumber: i, putUrl });
  }

  return NextResponse.json({
    data: {
      uploadId: s.id,
      fileKey: s.ossKey,
      fileName: s.fileName,
      fileSize: s.fileSize.toString(),
      chunkSize: s.chunkSize,
      totalParts: s.totalChunks,
      received,
      missing,
    },
  });
}
