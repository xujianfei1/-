/**
 * 本地文件系统 StorageDriver
 *
 * 根目录: STORAGE_ROOT env 或默认值
 *   - 生产 (ECS): /www/pan_data
 *   - 本地 dev:  ./storage (相对项目根, 自动解析为绝对路径)
 *
 * Key → 物理文件:  ${root}/${key}
 *   例: STORAGE_ROOT=/www/pan_data, key="u_abc/parent_xyz/123__photo.jpg"
 *   → /www/pan_data/u_abc/parent_xyz/123__photo.jpg
 */
import { createReadStream, createWriteStream, promises as fsp } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import type { StorageDriver } from './types';
import { assertSafeKey } from './types';

function resolveRoot(): string {
  const raw = process.env.STORAGE_ROOT?.trim();
  if (!raw) {
    return resolve(process.cwd(), 'storage');
  }
  return resolve(raw);
}

export class LocalDriver implements StorageDriver {
  private readonly root: string;

  constructor(root?: string) {
    this.root = root ?? resolveRoot();
  }

  private pathFor(key: string): string {
    assertSafeKey(key);
    const full = join(this.root, key);
    // 防御: 解析后必须仍在 root 下 (防 '..' 绕过)
    const normalized = resolve(full);
    if (normalized !== this.root && !normalized.startsWith(this.root + sep)) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return normalized;
  }

  async put(key: string, data: Buffer | Readable): Promise<void> {
    const p = this.pathFor(key);
    await fsp.mkdir(dirname(p), { recursive: true });
    const src = Buffer.isBuffer(data) ? Readable.from(data) : data;
    await pipeline(src, createWriteStream(p));
  }

  async get(key: string): Promise<Readable> {
    const p = this.pathFor(key);
    if (!(await fsp.stat(p).catch(() => null))) {
      throw new Error(`storage key not found: ${key}`);
    }
    return createReadStream(p);
  }

  async delete(key: string): Promise<void> {
    const p = this.pathFor(key);
    await fsp.unlink(p).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }

  async exists(key: string): Promise<boolean> {
    const p = this.pathFor(key);
    return !!(await fsp.stat(p).catch(() => null));
  }

  async size(key: string): Promise<number> {
    const p = this.pathFor(key);
    const s = await fsp.stat(p).catch(() => null);
    return s?.size ?? 0;
  }

  async concat(srcKeys: string[], destKey: string): Promise<void> {
    const dest = this.pathFor(destKey);
    await fsp.mkdir(dirname(dest), { recursive: true });
    const out = createWriteStream(dest);
    try {
      for (const k of srcKeys) {
        const src = this.pathFor(k);
        // 顺序读取, 用 pipeline 单 chunk 流式 (避免一次性读整个 chunk 到内存)
        await pipeline(createReadStream(src), out, { end: false });
      }
    } finally {
      out.end();
    }
    // 等写盘完成
    await new Promise<void>((resolve, reject) => {
      out.on('finish', () => resolve());
      out.on('error', reject);
    });
  }

  // 直传相关方法: 本地存储不支持 (没有预签名机制, 客户端只能走 next-server).
  // API 层在调用前会判 driver 类型; 这里抛清晰错误防误用.
  async initMultipartUpload(): Promise<{ uploadId: string; key: string }> {
    throw new Error('LocalDriver does not support direct upload (initMultipartUpload)');
  }
  async createPresignedPutUrl(): Promise<string> {
    throw new Error('LocalDriver does not support direct upload (createPresignedPutUrl)');
  }
  async completeMultipartUpload(): Promise<void> {
    throw new Error('LocalDriver does not support direct upload (completeMultipartUpload)');
  }
  async abortMultipartUpload(): Promise<void> {
    throw new Error('LocalDriver does not support direct upload (abortMultipartUpload)');
  }
  async listMultipartParts(): Promise<Array<{ partNumber: number; etag: string; size: number }>> {
    throw new Error('LocalDriver does not support direct upload (listMultipartParts)');
  }
}
