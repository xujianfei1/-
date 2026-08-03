/**
 * POST /api/pan/upload/start
 * Body (JSON): { name, fileSize, mimeType?, chunkSize?, parentId?, isShared, isZip? }
 * Response: { uploadId, chunkSize, totalChunks, receivedMask, chunksDir, stagingKey }
 *
 * 配额: 私人文件 (isShared=false) 在这里一次性 check, 防止后续 complete 时超额.
 *      共享文件不计入配额.
 * isZip: 上传的是 zip 压缩包, complete 时服务端解压到 parentId 下.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  startUploadSession,
  QuotaExceededError,
} from '@/lib/pan-queries';
import { chunkedStartSchema } from '@/lib/pan-validations';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

function normalizeChunkSize(input: number | undefined): number {
  const n = input ?? DEFAULT_CHUNK_SIZE;
  // 四舍五入到 1MB
  const rounded = Math.max(MIN_CHUNK_SIZE, Math.round(n / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE);
  return Math.min(MAX_CHUNK_SIZE, rounded);
}

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
  const parsed = chunkedStartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数无效', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const chunkSize = normalizeChunkSize(parsed.data.chunkSize);
  const fileSize = BigInt(parsed.data.fileSize);

  try {
    const { session: s, chunksDir, stagingKey } = await startUploadSession(userId, {
      name: parsed.data.name,
      fileSize,
      mimeType: parsed.data.mimeType ?? null,
      chunkSize,
      parentId: parsed.data.parentId,
      isShared: parsed.data.isShared,
      isZip: parsed.data.isZip,
    });
    return NextResponse.json(
      {
        data: {
          uploadId: s.id,
          chunkSize: s.chunkSize,
          totalChunks: s.totalChunks,
          receivedMask: JSON.parse(s.receivedMask) as boolean[],
          chunksDir,
          stagingKey,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: '配额已满',
          code: 'QUOTA_EXCEEDED',
          data: {
            used: e.used.toString(),
            limit: e.limit.toString(),
            adding: e.adding.toString(),
          },
        },
        { status: 413 },
      );
    }
    console.error('upload/start failed:', e);
    return NextResponse.json({ error: '创建上传会话失败' }, { status: 500 });
  }
}