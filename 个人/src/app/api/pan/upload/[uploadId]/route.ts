/**
 * /api/pan/upload/[uploadId]
 *   GET: 查单个 session + 当前 OSS 端 part 状态 (续传用)
 *   DELETE: 取消上传 (proxy 清 staging, direct abort multipart)
 *
 * GET Response: { data: { id, fileName, fileSize, chunkSize, totalChunks,
 *                          mode, received, receivedMask, ossReceived,
 *                          ossReceivedParts: [{ partNumber, etag }],
 *                          parentId, isShared, status, createdAt, updatedAt } }
 *
 * 续传场景: 客户端拿 ossReceivedParts 直接 PUT 缺的 part, 然后调 /direct/complete
 *           传完整 parts 列表 (含已传 etag).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  getSessionForUser,
  parseReceivedMask,
  countReceived,
} from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;
  const { uploadId } = await ctx.params;

  const s = await getSessionForUser(userId, uploadId);
  if (!s) {
    return NextResponse.json({ error: '上传会话不存在' }, { status: 404 });
  }

  const mask = parseReceivedMask(s.receivedMask, s.totalChunks);
  let ossReceived: number[] = [];
  let ossReceivedParts: Array<{ partNumber: number; etag: string }> = [];
  let ossReceivedSize = 0;
  if (s.mode === 'direct' && s.ossUploadId && s.ossKey) {
    try {
      const parts = await getStorage().listMultipartParts(s.ossKey, s.ossUploadId);
      ossReceived = parts.map((p) => p.partNumber);
      ossReceivedParts = parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag }));
      ossReceivedSize = parts.reduce((sum, p) => sum + p.size, 0);
    } catch (e) {
      console.warn('upload GET: listMultipartParts failed:', e);
    }
  }

  return NextResponse.json({
    data: {
      id: s.id,
      fileName: s.fileName,
      fileSize: s.fileSize.toString(),
      mimeType: s.mimeType,
      chunkSize: s.chunkSize,
      totalChunks: s.totalChunks,
      mode: s.mode,
      received: s.mode === 'direct' ? ossReceivedSize : countReceived(mask),
      receivedMask: mask,
      ossReceived,
      ossReceivedParts,
      ossKey: s.ossKey,
      parentId: s.parentId,
      isShared: s.isShared,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
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
    return NextResponse.json({ error: '会话已完成, 不能取消' }, { status: 409 });
  }

  if (s.mode === 'direct' && s.ossUploadId && s.ossKey) {
    // 直传: 调 storage.abortMultipartUpload 清掉 OSS 上的 part
    const storage = getStorage();
    try {
      await storage.abortMultipartUpload(s.ossKey, s.ossUploadId);
    } catch (e) {
      // 找不到 (已 abort) 不报错, 别的错记日志但继续
      console.warn('upload abort: oss abort failed:', e);
    }
  } else if (s.storageKey) {
    // proxy: 删 staging chunks
    try {
      const { cleanupStaging } = await import('@/lib/pan-queries');
      await cleanupStaging(s.storageKey);
    } catch (e) {
      console.warn('upload abort: staging cleanup failed:', e);
    }
  }

  const { markSessionAborted } = await import('@/lib/pan-queries');
  await markSessionAborted(uploadId);

  return NextResponse.json({ data: { uploadId, status: 'aborted' } });
}
