/**
 * GET /api/pan/uploads?status=uploading
 * 列当前用户的 active upload sessions (用于断点续传 UI)
 *
 * Response: { data: [{ id, fileName, fileSize, mimeType, chunkSize, totalChunks,
 *                     received, ossReceived, mode, ossKey, parentId, isShared,
 *                     createdAt, updatedAt }] }
 *
 * 包含 mode='direct' 和 mode='proxy' 两种 session:
 *   - proxy (老 chunked): received 来自 receivedMask
 *   - direct: received 来自 OSS listParts 实时查
 *
 * 客户端用 ossReceived 字段判断续传时哪些 part 已经在 OSS 端完成.
 */
import { NextResponse } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  listActiveSessions,
  parseReceivedMask,
  countReceived,
} from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;

  const rows = await listActiveSessions(userId);
  const storage = getStorage();
  const data = await Promise.all(
    rows.map(async (r) => {
      let ossReceived: number[] | null = null;
      let ossReceivedSize = 0;
      if (r.mode === 'direct' && r.ossUploadId && r.ossKey) {
        try {
          const parts = await storage.listMultipartParts(r.ossKey, r.ossUploadId);
          ossReceived = parts.map((p) => p.partNumber);
          ossReceivedSize = parts.reduce((sum, p) => sum + p.size, 0);
        } catch (e) {
          // 已 complete 或已 abort: 该 session 不再是 uploading 状态, 但 listActive 过滤了 status='uploading'.
          // 如果还遇到, 说明 OSS 端跟 DB 不一致, 返回空数组继续, 客户端可看到但续传会失败.
          console.warn('uploads: listMultipartParts failed for', r.id, e);
        }
      }
      const mask = parseReceivedMask(r.receivedMask, r.totalChunks);
      return {
        id: r.id,
        fileName: r.fileName,
        fileSize: r.fileSize.toString(),
        mimeType: r.mimeType,
        chunkSize: r.chunkSize,
        totalChunks: r.totalChunks,
        received: r.mode === 'direct' ? ossReceivedSize : countReceived(mask),
        receivedMask: mask,
        ossReceived, // null for proxy, array of part numbers for direct
        mode: r.mode,
        ossKey: r.ossKey,
        parentId: r.parentId,
        isShared: r.isShared,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    }),
  );
  return NextResponse.json({ data });
}
