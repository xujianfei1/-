/**
 * 云盘 (pan.xujianfei.cn) 存储后端抽象
 *
 * M1: LocalDriver — ECS 本地盘, 根目录从 STORAGE_ROOT env 读
 * M2: OssDriver   — 阿里云 OSS, 用 ali-oss npm 包
 *
 * 业务代码只依赖此 interface, 不直接 import 具体 driver.
 * 通过 src/lib/storage/index.ts 的 getStorage() 拿到实例.
 *
 * Key 规范:
 *   - 不允许包含 '/..', '\', 绝对路径
 *   - 推荐格式: `${scope}/${parentId}/${cuid}__${sanitizedName}`
 *     scope = user id 或 "shared"
 *   - driver 内部做最终 sanitize, 业务不必担心 path traversal
 */
import type { Readable } from 'node:stream';

export interface StorageDriver {
  /** 写入一个对象. data 可以是 Buffer (小文件) 或 Readable (流式, 大文件) */
  put(key: string, data: Buffer | Readable, contentType?: string): Promise<void>;
  /** 读取一个对象为流 */
  get(key: string): Promise<Readable>;
  /** 删除一个对象 (不存在不报错) */
  delete(key: string): Promise<void>;
  /** 检查对象是否存在 */
  exists(key: string): Promise<boolean>;
  /** 对象字节数; 不存在返回 0 */
  size(key: string): Promise<number>;
  /**
   * 顺序拼接多个 source key 到 dest key (用于分块上传 complete).
   * srcKeys 顺序拼接, destKey 会被覆盖 (如已存在).
   */
  concat(srcKeys: string[], destKey: string): Promise<void>;
  /**
   * 初始化一个 multipart upload. 返回 OSS 的 uploadId (后续 complete/abort 要用).
   * 只有支持分块的驱动实现; LocalDriver 抛 'not supported'.
   */
  initMultipartUpload(key: string, contentType?: string): Promise<{ uploadId: string; key: string }>;
  /**
   * 生成一个 multipart 预签名 PUT URL, 客户端可直接上传 part 字节而不经过服务端.
   * expiresIn: 秒, 默认 600 (10min). 上传大文件分片时建议 1800+ (30min+).
   * uploadId / partNumber 必须传, 否则 PUT 上去的字节不会被绑定到这个 multipart session.
   * 只有支持预签名的驱动实现; LocalDriver 抛 'not supported'.
   */
  createPresignedPutUrl(
    key: string,
    uploadId: string,
    partNumber: number,
    expiresIn?: number,
  ): Promise<string>;
  /**
   * 完成 multipart upload: 把所有 part 拼成最终对象.
   * parts: [{ partNumber, etag }]. etag 必须严格按 partNumber 升序.
   * 失败时会自动 abort (清掉已上传的 part).
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void>;
  /**
   * 取消 multipart upload: 删除已上传的所有 part.
   * 找不到 (已 complete 或已 abort) 不报错.
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

/** 禁止的 key 模式 (防 path traversal / shell 注入 / 绝对路径)
 *  允许:  "u_abc/parent_xyz/file.jpg" 这种用 / 分段的形式
 *  禁止:
 *    - 空 key
 *    - 反斜杠 / NULL 字符 / 长度 > 1024
 *    - 含 '..' 段 (如 '..', 'a/../b', 'a/..')
 *    - 开头或结尾的 '/'
 */
const FORBIDDEN_CHARS = /[\\\0]/;
const DOTDOT_SEGMENT = /(^|\/)\.\.($|\/)/;
const LEADING_OR_TRAILING_SLASH = /^\/|\/$/;

export function assertSafeKey(key: string): void {
  if (!key) throw new Error('storage key is empty');
  if (FORBIDDEN_CHARS.test(key)) {
    throw new Error(`unsafe storage key: ${JSON.stringify(key)}`);
  }
  if (DOTDOT_SEGMENT.test(key)) {
    throw new Error(`unsafe storage key (path traversal): ${JSON.stringify(key)}`);
  }
  if (LEADING_OR_TRAILING_SLASH.test(key)) {
    throw new Error(`unsafe storage key (leading/trailing slash): ${JSON.stringify(key)}`);
  }
  if (key.length > 1024) {
    throw new Error(`storage key too long: ${key.length} > 1024`);
  }
}
