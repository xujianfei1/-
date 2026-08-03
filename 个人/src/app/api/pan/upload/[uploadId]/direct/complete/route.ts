/**
 * POST /api/pan/upload/[uploadId]/direct/complete
 * Body: { parts: [{ partNumber, etag }] }
 * Response: { data: FileItem } (201)
 *
 * 完成直传 multipart upload:
 *   1. 校验所有 part 都收到 (用 parts 数组判断, 不用 receivedMask)
 *   2. storage.completeMultipartUpload (按 partNumber 升序)
 *   3. 建 File 记录, 标记 session completed
 *   4. multipart 完成后, OSS 已有完整对象, 不用搬移
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/auth';
import { getSessionForUser, createFileRecord, markSessionCompleted } from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const completeSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1).max(255),
      }),
    )
    .min(1)
    .max(10000),
});

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
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
    return NextResponse.json({ error: '会话已完成' }, { status: 409 });
  }
  if (s.status === 'aborted') {
    return NextResponse.json({ error: '会话已取消' }, { status: 409 });
  }
  if (s.mode !== 'direct' || !s.ossUploadId || !s.ossKey) {
    return NextResponse.json(
      { error: '该会话不是直传模式' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.parts.length !== s.totalChunks) {
    return NextResponse.json(
      {
        error: `part 数量不匹配: 期望 ${s.totalChunks}, 收到 ${parsed.data.parts.length}`,
      },
      { status: 400 },
    );
  }

  const storage = getStorage();
  // 1. complete multipart (失败时 storage 内部会 abort)
  try {
    await storage.completeMultipartUpload(s.ossKey, s.ossUploadId, parsed.data.parts);
  } catch (e) {
    console.error('upload/direct/complete: oss complete failed:', e);
    return NextResponse.json({ error: 'OSS 拼接收尾失败' }, { status: 500 });
  }

  // 2. 建 File 记录 (失败要回滚: 删 OSS 对象, abort session 不行因为已完成)
  let record;
  try {
    record = await createFileRecord(userId, {
      name: s.fileName,
      parentId: s.parentId,
      mimeType: s.mimeType || 'application/octet-stream',
      size: s.fileSize,
      storageKey: s.ossKey,
      isShared: s.isShared,
    });
  } catch (e) {
    // DB 失败, OSS 对象已存在, 删掉避免孤儿对象
    await storage.delete(s.ossKey).catch((err) => {
      console.error('upload/direct/complete: rollback delete failed:', err);
    });
    console.error('upload/direct/complete: db insert failed:', e);
    return NextResponse.json({ error: '创建文件记录失败' }, { status: 500 });
  }

  await markSessionCompleted(s.id);

  return NextResponse.json({ data: record }, { status: 201 });
}
