/**
 * POST /api/pan/upload/direct/start
 * Body (JSON): { name, fileSize, mimeType?, chunkSize?, parentId?, isShared }
 * Response: { data: { uploadId, fileKey, partSize, totalParts, parts: [{ partNumber, putUrl }] } }
 *
 * 直传 OSS multipart: 客户端拿每 part 的 putUrl 直接 PUT 到 OSS, 不走 next-server.
 * 配额: 私人文件 (isShared=false) 在这里 check, complete 时不再 check.
 *
 * 限制:
 *   - 只支持 OssDriver (STORAGE_DRIVER=oss); LocalDriver 直接返 501
 *   - chunkSize 最小 1MB, 最大 50MB, 默认 5MB
 *   - 单文件最大 10GB (与 chunkedStartSchema 一致)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { startDirectUploadSession, QuotaExceededError } from '@/lib/pan-queries';
import { chunkedStartSchema } from '@/lib/pan-validations';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB

function normalizeChunkSize(input: number | undefined): number {
  const n = input ?? DEFAULT_CHUNK_SIZE;
  const rounded = Math.max(MIN_CHUNK_SIZE, Math.round(n / MIN_CHUNK_SIZE) * MIN_CHUNK_SIZE);
  return Math.min(MAX_CHUNK_SIZE, rounded);
}

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;

  // 直传要求 OSS 驱动
  if ((process.env.STORAGE_DRIVER ?? 'local').toLowerCase() !== 'oss') {
    return NextResponse.json(
      { error: '直传仅支持 OSS 存储, 当前驱动不支持' },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  // 复用 chunkedStartSchema, 字段一致
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
    const { session: s, partUrls, finalKey } = await startDirectUploadSession(userId, {
      name: parsed.data.name,
      fileSize,
      mimeType: parsed.data.mimeType ?? null,
      chunkSize,
      parentId: parsed.data.parentId,
      isShared: parsed.data.isShared,
    });
    return NextResponse.json(
      {
        data: {
          uploadId: s.id,
          fileKey: finalKey,
          partSize: chunkSize,
          totalParts: partUrls.length,
          parts: partUrls,
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
    // LocalDriver 'not supported' 兜底 (虽然上面已经 STORAGE_DRIVER 校验过, 防御一下)
    if (e instanceof Error && e.message.includes('does not support direct upload')) {
      return NextResponse.json({ error: e.message }, { status: 501 });
    }
    console.error('upload/direct/start failed:', e);
    return NextResponse.json({ error: '创建直传会话失败' }, { status: 500 });
  }
}
