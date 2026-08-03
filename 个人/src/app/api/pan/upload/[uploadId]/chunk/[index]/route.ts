/**
 * PUT /api/pan/upload/[uploadId]/chunk/[index]
 * Body: raw bytes (octet-stream) — 整个 chunk 的内容
 *
 * Response: { received: number, totalChunks: number, receivedMask: boolean[] }
 *
 * 幂等: 同一个 index 多次 PUT 是覆盖语义 (前端可放心重传).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  getSessionForUser,
  markChunkReceived,
  parseReceivedMask,
} from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';
// 单 chunk 上限 60s (本地 dev 快, 生产跨网才用得上)
export const maxDuration = 60;

type RouteContext = { params: Promise<{ uploadId: string; index: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;
  const { uploadId, index: indexStr } = await ctx.params;
  const index = Number(indexStr);
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: 'index 必须是 ≥ 0 的整数' }, { status: 400 });
  }

  const s = await getSessionForUser(userId, uploadId);
  if (!s) {
    return NextResponse.json({ error: '上传会话不存在' }, { status: 404 });
  }
  if (s.status !== 'uploading') {
    return NextResponse.json({ error: `会话状态 ${s.status}, 不能继续上传` }, { status: 409 });
  }
  if (index >= s.totalChunks) {
    return NextResponse.json(
      { error: `chunk index 超出范围 (max=${s.totalChunks - 1})` },
      { status: 400 },
    );
  }

  const contentType = req.headers.get('content-type') || '';
  if (contentType && !contentType.includes('octet-stream') && !contentType.includes('multipart')) {
    // 容忍, 不强制
  }

  // 读 body 到 Buffer (chunk 大小上限 50MB, Buffer 占用内存可控)
  const ab = await req.arrayBuffer();
  const buf = Buffer.from(ab);

  // 期望大小 (最后一个 chunk 可能更小)
  const isLast = index === s.totalChunks - 1;
  const expectedSize = isLast
    ? Number(s.fileSize - BigInt(s.chunkSize) * BigInt(s.totalChunks - 1))
    : s.chunkSize;
  if (buf.length !== expectedSize) {
    return NextResponse.json(
      { error: `chunk 大小不符 (期望 ${expectedSize}, 实际 ${buf.length})` },
      { status: 400 },
    );
  }

  // 写到 staging chunks 目录
  const chunksDir = s.storageKey.replace(/\/file$/, '/chunks');
  const chunkKey = `${chunksDir}/${index}`;
  const storage = getStorage();
  try {
    await storage.put(chunkKey, buf);
  } catch (e) {
    console.error('upload chunk: storage put failed:', e);
    return NextResponse.json({ error: 'chunk 写入失败' }, { status: 500 });
  }

  // 更新 mask
  let updated;
  try {
    updated = await markChunkReceived(uploadId, index, s.totalChunks);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: '会话丢失' }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      index,
      received: updated.received,
      totalChunks: s.totalChunks,
      receivedMask: updated.mask,
    },
  });
}

/** GET /api/pan/upload/[uploadId]/chunk/[index] — 查 chunk 是否已收到 (resume) */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const userId = a.userId;
  const { uploadId, index: indexStr } = await ctx.params;
  const index = Number(indexStr);
  const s = await getSessionForUser(userId, uploadId);
  if (!s) {
    return NextResponse.json({ error: '上传会话不存在' }, { status: 404 });
  }
  const mask = parseReceivedMask(s.receivedMask, s.totalChunks);
  return NextResponse.json({
    data: {
      received: !!mask[index],
      totalChunks: s.totalChunks,
    },
  });
}