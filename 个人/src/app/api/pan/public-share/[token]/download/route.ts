/**
 * GET /api/pan/share/[token]/download?token=<downloadToken>
 *
 * 用 access 接口拿到的 downloadToken 鉴权后下载.
 *
 * - 单文件: 直接 stream storage.get()
 * - 文件夹: 服务端用 fflate 边读边打包 zip 流 (ZipPassThrough, 不再压缩)
 *
 * Query:
 *   - token: 必填, access 接口返回的 1 小时一次性 token
 */
import { type NextRequest, NextResponse } from 'next/server';
import { Readable, PassThrough } from 'node:stream';
import { Zip, ZipPassThrough, zipSync } from 'fflate';
import { getShareByToken, collectFilesUnder } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { verifyDownloadToken } from '@/lib/share-token';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 大文件夹打包可能较久

type RouteContext = { params: Promise<{ token: string }> };

/** RFC 5987 / RFC 6266 编码 filename* (UTF-8) */
function encodeFilenameStar(name: string): string {
  return encodeURIComponent(name).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  const { token: shareToken } = await ctx.params;
  const downloadToken = req.nextUrl.searchParams.get('token');
  if (!downloadToken) {
    return NextResponse.json({ error: '缺少 downloadToken' }, { status: 400 });
  }

  const share = await getShareByToken(shareToken);
  if (!share) {
    return NextResponse.json({ error: '分享不存在' }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: '分享已过期' }, { status: 410 });
  }
  if (!verifyDownloadToken(share.id, downloadToken)) {
    return NextResponse.json({ error: 'downloadToken 无效或已过期' }, { status: 401 });
  }
  if (!share.allowDownload) {
    return NextResponse.json({ error: '该分享不允许下载' }, { status: 403 });
  }

  const file = await prisma.file.findUnique({ where: { id: share.fileId } });
  if (!file) {
    return NextResponse.json({ error: '文件已删除' }, { status: 410 });
  }

  const storage = getStorage();

  // 单文件 (非目录): 直接 stream
  if (!file.isDir) {
    if (!file.storageKey) {
      return NextResponse.json({ error: '文件元数据异常' }, { status: 500 });
    }
    const stat = await storage.size(file.storageKey).catch(() => 0);
    const stream = await storage.get(file.storageKey);
    const filenameStar = encodeFilenameStar(file.name);
    return new NextResponse(stream as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Length': String(stat),
        'Content-Disposition': `attachment; filename*=UTF-8''${filenameStar}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // 文件夹: 打包 zip 流
  const collected = await collectFilesUnder(file);
  if (collected.length === 0) {
    // 空目录也返回一个有效 zip: zipSync({}) 产出仅含 EOCD 的合法空包 (22 字节)
    const zipName = `${file.name}.zip`;
    const filenameStar = encodeFilenameStar(zipName);
    const emptyZip = zipSync({}, { level: 0 });
    const empty = new Readable({
      read() {
        this.push(Buffer.from(emptyZip));
        this.push(null);
      },
    });
    return new NextResponse(empty as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${filenameStar}`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // 流式打包: ZipPassThrough (不压缩, 边读边写, 内存友好)
  const zipName = `${file.name}.zip`;
  const filenameStar = encodeFilenameStar(zipName);

  const out = new PassThrough();
  const zip = new Zip((err, data, final) => {
    if (err) {
      out.destroy(err);
      return;
    }
    if (data) {
      out.write(Buffer.from(data));
    }
    if (final) {
      out.end();
    }
  });

  // 异步驱动: 按顺序 add, 每个 add 内部用 storage.get() 流式喂数据
  (async () => {
    try {
      for (const { relPath, file: child } of collected) {
        if (!child || !child.storageKey) continue;
        const entry = new ZipPassThrough(relPath);
        zip.add(entry);
        const rs = await storage.get(child.storageKey);
        // 把 Readable 的 chunk 喂给 entry (用 push 让 fflate 自动累 CRC/size)
        await new Promise<void>((resolve, reject) => {
          rs.on('data', (chunk: Buffer) => {
            // 拷贝到独立的 Uint8Array (避开 ArrayBufferLike/ArrayBuffer 类型差)
            const out = new Uint8Array(chunk.byteLength);
            out.set(chunk);
            entry.push(out, false);
          });
          rs.on('end', () => {
            entry.push(new Uint8Array(0), true);
            resolve();
          });
          rs.on('error', reject);
        });
      }
      zip.end();
    } catch (e) {
      zip.terminate();
      out.destroy(e instanceof Error ? e : new Error(String(e)));
    }
  })();

  return new NextResponse(out as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${filenameStar}`,
      'Cache-Control': 'no-store',
    },
  });
}
