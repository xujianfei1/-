/**
 * 阿里云 OSS StorageDriver
 *
 * 配置 (从 env 读):
 *   OSS_REGION             e.g. oss-cn-hangzhou
 *   OSS_BUCKET             e.g. my-pan-files
 *   OSS_ACCESS_KEY_ID
 *   OSS_ACCESS_KEY_SECRET
 *   OSS_INTERNAL           'true' 时用内网 endpoint (ECS 同区更快且免流量费)
 *   OSS_ENDPOINT           自定义 endpoint (可选, 一般用不到)
 *
 * 启用: STORAGE_DRIVER=oss
 *
 * 鉴权: AccessKey (RAM 子账号, 只给 oss:* 这个 bucket 权限即可, 不要用主账号).
 *       长期生产建议用 STS / RAM Role, 本项目体量用 AccessKey 够.
 *
 * Object ACL: 默认 private (不公开读). 分享链接走 server 端代下载.
 */
import { Readable } from 'node:stream';
import OSS from 'ali-oss';
import type { OSSClient } from 'ali-oss';
import type { StorageDriver } from './types';

interface OssConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  internal: boolean;
  endpoint?: string;
}

function readConfig(): OssConfig {
  const region = process.env.OSS_REGION?.trim();
  const bucket = process.env.OSS_BUCKET?.trim();
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID?.trim();
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET?.trim();
  const internal = process.env.OSS_INTERNAL?.toLowerCase() === 'true';
  const endpoint = process.env.OSS_ENDPOINT?.trim();
  const missing: string[] = [];
  if (!region) missing.push('OSS_REGION');
  if (!bucket) missing.push('OSS_BUCKET');
  if (!accessKeyId) missing.push('OSS_ACCESS_KEY_ID');
  if (!accessKeySecret) missing.push('OSS_ACCESS_KEY_SECRET');
  if (missing.length > 0) {
    throw new Error(`OssDriver: missing env vars: ${missing.join(', ')}`);
  }
  return {
    region: region!,
    bucket: bucket!,
    accessKeyId: accessKeyId!,
    accessKeySecret: accessKeySecret!,
    internal,
    endpoint: endpoint || undefined,
  };
}

export class OssDriver implements StorageDriver {
  private readonly client: OSSClient;
  /** 独立的公网 client: 用来给浏览器签 presigned URL.
   *  走 OSS_INTERNAL=true 时, this.client 是内网 endpoint, 浏览器访问不到 (内网 IP),
   *  必须在签 URL 时切到公网, 否则浏览器直传报 "网络错误". */
  private readonly publicClient: OSSClient;
  private readonly bucket: string;

  constructor(config?: Partial<OssConfig>) {
    const cfg = { ...readConfig(), ...config };
    this.bucket = cfg.bucket;
    this.client = new OSS({
      region: cfg.region,
      bucket: cfg.bucket,
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      internal: cfg.internal,
      secure: true,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, cname: true } : {}),
    });
    // 签 URL 给浏览器用: 强制公网 endpoint (不带 -internal 后缀)
    this.publicClient = new OSS({
      region: cfg.region,
      bucket: cfg.bucket,
      accessKeyId: cfg.accessKeyId,
      accessKeySecret: cfg.accessKeySecret,
      internal: false,
      secure: true,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, cname: true } : {}),
    });
  }

  async put(key: string, data: Buffer | Readable, contentType?: string): Promise<void> {
    const headers = contentType ? { 'Content-Type': contentType } : undefined;
    if (Buffer.isBuffer(data)) {
      await this.client.put(key, data, headers ? { headers } : undefined);
    } else {
      await this.client.putStream(key, data, headers ? { headers } : undefined);
    }
  }

  async get(key: string): Promise<Readable> {
    const { stream } = await this.client.getStream(key);
    return stream;
  }

  /** 不存在不报错 (LocalDriver 行为对齐) */
  async delete(key: string): Promise<void> {
    try {
      await this.client.delete(key);
    } catch (e) {
      if (isNotFound(e)) return;
      throw e;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.head(key);
      return true;
    } catch (e) {
      if (isNotFound(e)) return false;
      throw e;
    }
  }

  async size(key: string): Promise<number> {
    try {
      const head = await this.client.head(key);
      // ali-oss SDK: res.size 是响应体大小 (HEAD 请求为 0), 真实对象大小在 Content-Length header
      const headers = head.res.headers as Record<string, string | undefined>;
      const sizeStr = headers['content-length'] ?? headers['Content-Length'] ?? '0';
      const n = Number(sizeStr);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      if (isNotFound(e)) return 0;
      throw e;
    }
  }

  /**
   * 顺序拼接多个 source object → dest object (服务端, 不下载到本地).
   * 用 multipart upload + UploadPartCopy.
   *
   * 单源: 直接 CopyObject (便宜, 不走 multipart).
   */
  async concat(srcKeys: string[], destKey: string): Promise<void> {
    if (srcKeys.length === 0) return;
    if (srcKeys.length === 1) {
      await this.client.copy(destKey, srcKeys[0]!);
      return;
    }
    // 多源: multipart upload + 每个 part 用 UploadPartCopy (服务端 copy)
    const { uploadId } = await this.client.initMultipartUpload(destKey);
    const parts: Array<{ number: number; etag: string }> = [];
    try {
      for (let i = 0; i < srcKeys.length; i++) {
        const srcKey = srcKeys[i]!;
        const head = await this.client.head(srcKey);
        // res.size 是响应体大小 (HEAD 为 0), 真实对象大小在 Content-Length header
        const headers = head.res.headers as Record<string, string | undefined>;
        const size = Number(headers['content-length'] ?? headers['Content-Length'] ?? '0');
        if (!Number.isFinite(size) || size <= 0) continue; // 0 字节源跳过 (UploadPartCopy range 非空)
        const range = `0-${size - 1}`; // inclusive
        const result = await this.client.uploadPartCopy(
          destKey,
          uploadId,
          i + 1,
          range,
          { sourceKey: srcKey, sourceBucketName: this.bucket },
          { timeout: 120_000 },
        );
        parts.push({ number: i + 1, etag: result.etag });
      }
      if (parts.length === 0) {
        // 全部源都是 0 字节, abort multipart 然后写个空 object
        await this.client.abortMultipartUpload(destKey, uploadId);
        await this.client.put(destKey, Buffer.alloc(0));
        return;
      }
      await this.client.completeMultipartUpload(destKey, uploadId, parts);
    } catch (e) {
      try {
        await this.client.abortMultipartUpload(destKey, uploadId);
      } catch {
        // ignore
      }
      throw e;
    }
  }

  /**
   * 直传 OSS multipart: 客户端拿预签名 URL 直接 PUT 到 OSS, 不走 next-server.
   * OSS multipart 单 part 最小 100KB (最后一块不限). 业务要保证除最后一块外都 >= 100KB.
   * 上传分块大小 5MB 起步即可.
   */
  async initMultipartUpload(key: string, contentType?: string): Promise<{ uploadId: string; key: string }> {
    const headers = contentType ? { 'Content-Type': contentType } : undefined;
    const { uploadId } = await this.client.initMultipartUpload(key, headers ? { headers } : undefined);
    return { uploadId, key };
  }

  /**
   * 预签名 multipart PUT URL: 让客户端直接 PUT 字节到 OSS 的指定 part, 不经服务端.
   * 注意: ali-oss v6 的 signatureUrl 不会自动加 partNumber/uploadId 到 query, 必须显式传 subResource.
   * 不传 subResource 的话 PUT 上去会被 OSS 当作普通对象上传 (覆盖 placeholder), 不属于这个 multipart session.
   * 客户端 PUT 后, response header 'ETag' 必须带回 complete 接口 (带引号, SDK 内部处理).
   */
  async createPresignedPutUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn = 600,
  ): Promise<string> {
    const url = this.publicClient.signatureUrl(key, {
      method: 'PUT',
      expires: expiresIn,
      subResource: { partNumber, uploadId },
    });
    return url;
  }

  /**
   * 完成 multipart upload: parts 必须按 partNumber 升序.
   * 失败会自动 abort (清 part), 避免残留.
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    const aliParts = sorted.map((p) => ({ number: p.partNumber, etag: p.etag }));
    try {
      await this.client.completeMultipartUpload(key, uploadId, aliParts);
    } catch (e) {
      try {
        await this.client.abortMultipartUpload(key, uploadId);
      } catch {
        // ignore
      }
      throw e;
    }
  }

  /**
   * 取消 multipart upload: 已上传的 part 全删.
   * 不存在 (已 complete/abort) 不报错.
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.abortMultipartUpload(key, uploadId);
    } catch (e) {
      if (isNotFound(e)) return;
      throw e;
    }
  }

  /**
   * 列已上传的 parts. ali-oss 的 listParts 返回的 ETag 带头尾双引号, 剥掉.
   * 用于断点续传: 客户端先调这个, 跳过已上传 part, 只传剩下的.
   * OSS 单次 max-parts 上限 1000; 大文件 (5MB × 2000 = 10GB = 2000 part) 需要翻页.
   * 翻页条件: 返回 nextPartNumberMarker 时再用 marker 查下一页. 这里实现完整翻页.
   */
  async listMultipartParts(
    key: string,
    uploadId: string,
  ): Promise<Array<{ partNumber: number; etag: string; size: number }>> {
    const out: Array<{ partNumber: number; etag: string; size: number }> = [];
    let marker: string | undefined;
    for (let page = 0; page < 100; page++) { // 上限 100 页 = 100000 part = 500GB, 防御
      const query: any = { 'max-parts': 1000 };
      if (marker) query['part-number-marker'] = marker;
      const result: any = await this.client.listParts(key, uploadId, query);
      const parts: any[] = result.parts || [];
      for (const p of parts) {
        out.push({
          partNumber: Number(p.PartNumber ?? p.partNumber),
          etag: String(p.ETag ?? p.etag ?? '').replace(/^"|"$/g, ''),
          size: Number(p.Size ?? p.size ?? 0),
        });
      }
      marker = result.nextPartNumberMarker ? String(result.nextPartNumberMarker) : undefined;
      if (!marker || String(result.isTruncated) !== 'true') break;
    }
    return out;
  }
}

/** 兼容 ali-oss 各种 "不存在" 错误. 404 (NoSuchKey) / NoSuchBucket / NotFound. */
function isNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as { code?: string; status?: number; name?: string };
  return (
    err.code === 'NoSuchKey' ||
    err.code === 'NoSuchBucket' ||
    err.code === 'NotFound' ||
    err.status === 404 ||
    err.name === 'NoSuchKeyError'
  );
}
