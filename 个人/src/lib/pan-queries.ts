/**
 * 云盘 Prisma 封装
 *
 * 权限模型 (M1):
 *   - 私人文件 (isShared=false): 只有 owner (ownerId) 可读/改/删
 *   - 共享池  (isShared=true) : 任何登录用户可读/改/删
 *   - 配额:  只算 ownerId=me AND NOT isShared 的文件大小总和
 *
 * Admin 旁路 (M3):
 *   - 所有 read/write/delete 函数接受 `asAdmin: boolean`, admin 跳过 ownerId 校验
 *   - 配额:  admin 仍按自己配额算 (admin 操作不计入配额)
 *   - 调用方负责校验调用者 isAdmin=true (用 requireAdmin)
 */
import { prisma } from './prisma';
import { getStorage } from './storage';
import { randomBytes } from 'node:crypto';

export type Scope = 'private' | 'shared';

/** File record 中 size (BigInt) 序列化为 string 才能 JSON.stringify */
type FileWithBigInt = { size: bigint };
type SerializableFile<F extends FileWithBigInt> = Omit<F, 'size'> & { size: string };

/** 把任意带 BigInt size 的 File 转成可 JSON 序列化的 */
function toSerializable<F extends FileWithBigInt>(f: F): SerializableFile<F> {
  return { ...f, size: f.size.toString() };
}

/**
 * 列出某目录下的子文件. parentId=null 视作根.
 * - scope='shared': 列出共享池
 * - scope='private': 仅列自己私人 (ownerId=userId)
 * - asAdmin=true: 列所有用户私人 (admin 看别人根目录时用)
 * - q: 按 name LIKE 过滤 (仅当前目录)
 */
export async function listChildren(
  userId: string,
  parentId: string | null,
  scope: Scope,
  q?: string,
  options?: { asAdmin?: boolean },
) {
  const isAdmin = options?.asAdmin === true;
  const where = scope === 'shared'
    ? { isShared: true, parentId, ...(q ? { name: { contains: q } } : {}) }
    : isAdmin
      ? { isShared: false, parentId, ...(q ? { name: { contains: q } } : {}) }
      : { ownerId: userId, isShared: false, parentId, ...(q ? { name: { contains: q } } : {}) };
  const rows = await prisma.file.findMany({
    where,
    orderBy: [{ isDir: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toSerializable);
}

/**
 * 取单个文件 + 鉴权.
 * - 共享池: 全员可见
 * - 私人文件: ownerId 必须等于 userId
 * - asAdmin=true: 跳过 ownerId 校验
 */
export async function getFileForUser(userId: string, fileId: string, options?: { asAdmin?: boolean }) {
  const f = await prisma.file.findUnique({ where: { id: fileId } });
  if (!f) return null;
  if (f.isShared) return f; // 共享池全员可见
  if (options?.asAdmin === true) return f; // admin 旁路
  if (f.ownerId === userId) return f;
  return null; // 私人文件非 owner
}

function assertCanWrite(
  userId: string,
  file: { isShared: boolean; ownerId: string | null },
  options?: { asAdmin?: boolean },
) {
  if (file.isShared) return; // 共享池全员可写
  if (options?.asAdmin === true) return; // admin 旁路
  if (file.ownerId === userId) return;
  throw new ForbiddenError('forbidden');
}

export class ForbiddenError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotFoundError';
  }
}

export class QuotaExceededError extends Error {
  constructor(public used: bigint, public limit: bigint, public adding: bigint) {
    super('quota exceeded');
    this.name = 'QuotaExceededError';
  }
}

/** 当前用户私人文件总占用 (字节, number 用于 JSON 序列化) */
export async function getQuotaUsage(userId: string): Promise<bigint> {
  const agg = await prisma.file.aggregate({
    where: { ownerId: userId, isShared: false, isDir: false },
    _sum: { size: true },
  });
  return BigInt(agg._sum.size ?? 0);
}

/** 取用户配额上限 (字节) */
export async function getQuotaLimit(userId: string): Promise<bigint> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { quotaBytes: true } });
  if (!u) throw new Error(`user not found: ${userId}`);
  return u.quotaBytes;
}

/** 检查并预留配额 (上传前). 超限抛 QuotaExceededError. */
export async function checkQuota(userId: string, adding: bigint): Promise<{ used: bigint; limit: bigint }> {
  const [used, limit] = await Promise.all([getQuotaUsage(userId), getQuotaLimit(userId)]);
  if (used + adding > limit) {
    throw new QuotaExceededError(used, limit, adding);
  }
  return { used, limit };
}

/** 创建文件夹 */
export async function createFolder(
  userId: string,
  input: { name: string; parentId: string | null; isShared: boolean },
) {
  const f = await prisma.file.create({
    data: {
      ownerId: input.isShared ? userId : userId, // 共享池 ownerId 记创建者 (审计)
      parentId: input.parentId,
      name: input.name,
      isDir: true,
      isShared: input.isShared,
    },
  });
  return toSerializable(f);
}

/** 重命名 (private 只 owner, shared 全员; admin 旁路) */
export async function renameFile(userId: string, fileId: string, newName: string, options?: { asAdmin?: boolean }) {
  const f = await getFileForUser(userId, fileId, options);
  if (!f) throw new NotFoundError('file not found');
  assertCanWrite(userId, f, options);
  const updated = await prisma.file.update({ where: { id: fileId }, data: { name: newName } });
  return toSerializable(updated);
}

/** 移动到新 parent (private 只 owner, shared 全员; admin 旁路) */
export async function moveFile(userId: string, fileId: string, newParentId: string | null, options?: { asAdmin?: boolean }) {
  const f = await getFileForUser(userId, fileId, options);
  if (!f) throw new NotFoundError('file not found');
  assertCanWrite(userId, f, options);
  if (newParentId) {
    // 校验 new parent 存在且对当前用户可见 (admin 旁路)
    const parent = await getFileForUser(userId, newParentId, options);
    if (!parent) throw new NotFoundError('parent not found');
    if (!parent.isDir) throw new Error('parent is not a directory');
  }
  const updated = await prisma.file.update({ where: { id: fileId }, data: { parentId: newParentId } });
  return toSerializable(updated);
}

/** 递归收集所有后代 id + 所有 storageKey (用于清理存储) */
async function collectDescendants(rootId: string): Promise<{ ids: string[]; storageKeys: (string | null)[] }> {
  const ids: string[] = [];
  const storageKeys: (string | null)[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const node = await prisma.file.findUnique({ where: { id } });
    if (!node) continue;
    ids.push(id);
    if (node.storageKey) storageKeys.push(node.storageKey);
    if (node.isDir) {
      const children = await prisma.file.findMany({ where: { parentId: id }, select: { id: true } });
      stack.push(...children.map((c) => c.id));
    }
  }
  return { ids, storageKeys };
}

/** 递归删除文件/目录 (物理文件 + 数据库; admin 旁路) */
export async function deleteRecursive(userId: string, fileId: string, options?: { asAdmin?: boolean }) {
  const f = await getFileForUser(userId, fileId, options);
  if (!f) throw new NotFoundError('file not found');
  assertCanWrite(userId, f, options);
  const { ids, storageKeys } = await collectDescendants(fileId);
  // 先删物理文件 (失败不致命, 后面有定时清理)
  const storage = getStorage();
  await Promise.allSettled(storageKeys.filter((k): k is string => !!k).map((k) => storage.delete(k)));
  // 再删 DB 行 (cascade 会自动处理子树, 但保险起见显式删)
  await prisma.file.deleteMany({ where: { id: { in: ids } } });
}

/** 创建上传文件元数据 (在 storage.put 成功之后) */
export async function createFileRecord(
  userId: string,
  input: {
    name: string;
    parentId: string | null;
    mimeType: string;
    size: bigint;
    storageKey: string;
    isShared: boolean;
  },
) {
  const f = await prisma.file.create({
    data: {
      ownerId: userId,
      parentId: input.parentId,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      storageKey: input.storageKey,
      isDir: false,
      isShared: input.isShared,
    },
  });
  return toSerializable(f);
}

/** 创建目录 (zip 解压时用) */
export async function createDirRecord(
  userId: string,
  input: {
    name: string;
    parentId: string | null;
    isShared: boolean;
  },
) {
  const f = await prisma.file.create({
    data: {
      ownerId: userId,
      parentId: input.parentId,
      name: input.name,
      mimeType: null,
      size: BigInt(0),
      storageKey: null,
      isDir: true,
      isShared: input.isShared,
    },
  });
  return toSerializable(f);
}

// ============================================================
// 分享链接 (M2)
// ============================================================

/** 生成 32 字节的 base64url token */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** 创建分享 (owner 才能分享自己的 file; 共享池 file 任意登录用户可分享) */
export async function createShare(
  userId: string,
  input: { fileId: string; passwordHash: string | null; expiresAt: Date | null; allowDownload: boolean },
) {
  return prisma.fileShare.create({
    data: {
      token: generateShareToken(),
      ownerId: userId,
      fileId: input.fileId,
      passwordHash: input.passwordHash,
      expiresAt: input.expiresAt,
      allowDownload: input.allowDownload,
    },
  });
}

/** 取分享 (含鉴权: 必须是 owner) */
export async function getShareForUser(userId: string, shareId: string) {
  return prisma.fileShare.findFirst({ where: { id: shareId, ownerId: userId } });
}

/** 取分享 (公开, 仅按 token) */
export async function getShareByToken(token: string) {
  return prisma.fileShare.findUnique({ where: { token } });
}

/** 增加访问计数 */
export async function touchShare(shareId: string) {
  return prisma.fileShare.update({
    where: { id: shareId },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  });
}

/** 列 owner 的所有分享 */
export async function listMyShares(userId: string) {
  return prisma.fileShare.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: 'desc' },
  });
}

/** 撤销分享 */
export async function revokeShare(userId: string, shareId: string) {
  return prisma.fileShare.deleteMany({ where: { id: shareId, ownerId: userId } });
}

/**
 * 递归收集 file 树下所有文件 (用于文件夹打包).
 * 返 [相对路径, File record] 列表, 跳过 macOS 元数据/系统隐藏文件.
 */
export async function collectFilesUnder(rootFile: { id: string; isDir: boolean; name: string; storageKey: string | null }): Promise<Array<{ relPath: string; file: Awaited<ReturnType<typeof prisma.file.findUnique>> }>> {
  if (!rootFile.isDir) {
    return rootFile.storageKey ? [{ relPath: rootFile.name, file: await prisma.file.findUnique({ where: { id: rootFile.id } }) }].filter((x): x is { relPath: string; file: NonNullable<typeof x.file> } => x.file !== null) : [];
  }
  // BFS 收集所有后代
  const out: Array<{ relPath: string; file: NonNullable<Awaited<ReturnType<typeof prisma.file.findUnique>>> }> = [];
  type QueueItem = { id: string; relPath: string };
  const queue: QueueItem[] = [{ id: rootFile.id, relPath: rootFile.name }];
  while (queue.length > 0) {
    const { id, relPath } = queue.shift()!;
    const children = await prisma.file.findMany({
      where: { parentId: id },
      orderBy: [{ isDir: 'desc' }, { name: 'asc' }],
    });
    for (const c of children) {
      if (c.isDir) {
        queue.push({ id: c.id, relPath: `${relPath}/${c.name}` });
      } else if (c.storageKey) {
        out.push({ relPath: `${relPath}/${c.name}`, file: c });
      }
    }
  }
  return out;
}

// ============================================================
// 分块上传会话 (M2)
// ============================================================

export type UploadSessionRow = Awaited<ReturnType<typeof prisma.uploadSession.findUnique>>;

/** chunk 数 */
export function computeTotalChunks(fileSize: bigint, chunkSize: number): number {
  return Number((fileSize + BigInt(chunkSize - 1)) / BigInt(chunkSize));
}

/** 把 receivedMask (JSON string) 解成 boolean[] */
export function parseReceivedMask(mask: string, totalChunks: number): boolean[] {
  let arr: boolean[];
  try {
    arr = JSON.parse(mask);
  } catch {
    arr = Array(totalChunks).fill(false);
  }
  // 长度对齐 (容错)
  if (arr.length !== totalChunks) {
    arr = Array.from({ length: totalChunks }, (_, i) => !!arr[i]);
  }
  return arr;
}

/** 把 boolean[] 序列化成 JSON string 存 DB */
export function serializeReceivedMask(arr: boolean[]): string {
  return JSON.stringify(arr);
}

/** 计算已收到 chunk 数 */
export function countReceived(arr: boolean[]): number {
  let n = 0;
  for (const v of arr) if (v) n++;
  return n;
}

/** 创建分块上传会话. 检查配额 + 返回 uploadId 等. */
export async function startUploadSession(
  userId: string,
  input: {
    name: string;
    fileSize: bigint;
    mimeType: string | null;
    chunkSize: number;
    parentId: string | null;
    isShared: boolean;
    isZip: boolean;
  },
) {
  // 配额检查 (私人文件才计入; isShared=true 不计入配额)
  if (!input.isShared) {
    await checkQuota(userId, input.fileSize);
  }
  const totalChunks = computeTotalChunks(input.fileSize, input.chunkSize);
  const session = await prisma.uploadSession.create({
    data: {
      ownerId: userId,
      fileName: input.name,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      chunkSize: input.chunkSize,
      totalChunks,
      receivedMask: serializeReceivedMask(Array(totalChunks).fill(false)),
      storageKey: '', // 下面填 (需要 cuid 作为目录名)
      parentId: input.parentId,
      isShared: input.isShared,
      isZip: input.isZip,
    },
  });
  // 用 session.id 作为 staging 目录名, 更新 storageKey
  const scope = input.isShared ? 'shared' : userId;
  const parentSegment = input.parentId ?? 'root';
  const stagingKey = `${scope}/staging/${session.id}/file`;
  const chunksDir = `${scope}/staging/${session.id}/chunks`;
  await prisma.uploadSession.update({
    where: { id: session.id },
    data: { storageKey: stagingKey },
  });
  return { session, chunksDir, stagingKey, scope, parentSegment };
}

/**
 * 直传 OSS multipart 会话 (M3 大文件优化).
 *
 * 流程:
 *   1. 配额检查 (私人文件)
 *   2. 算 final key
 *   3. storage.initMultipartUpload → 拿 ossUploadId
 *   4. 为每个 part 生成预签名 PUT URL
 *   5. 写回 session: mode='direct', ossUploadId, ossKey
 *
 * 客户端拿到 part URLs 后, 直接 PUT 到 OSS, 不再经 next-server.
 *
 * 注意:
 *   - 调用方必须保证 storage 支持 multipart (OssDriver); LocalDriver 会抛错.
 *   - 此函数只创建会话 + 返回 part URLs, 不负责清理 (abort 时清理).
 */
export async function startDirectUploadSession(
  userId: string,
  input: {
    name: string;
    fileSize: bigint;
    mimeType: string | null;
    chunkSize: number;
    parentId: string | null;
    isShared: boolean;
  },
) {
  // 配额检查 (私人文件才计入; isShared=true 不计入配额)
  if (!input.isShared) {
    await checkQuota(userId, input.fileSize);
  }
  const totalChunks = computeTotalChunks(input.fileSize, input.chunkSize);
  const scope = input.isShared ? 'shared' : userId;
  const parentSegment = input.parentId ?? 'root';

  // 直接传模式 storageKey 留空 (老字段不用), ossKey 是最终 key
  const session = await prisma.uploadSession.create({
    data: {
      ownerId: userId,
      fileName: input.name,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      chunkSize: input.chunkSize,
      totalChunks,
      receivedMask: serializeReceivedMask(Array(totalChunks).fill(false)),
      storageKey: '', // direct 模式不用
      parentId: input.parentId,
      isShared: input.isShared,
      isZip: false, // direct 模式暂不支持 zip (zip 仍走 proxy)
      mode: 'direct',
    },
  });

  // 最终 key (M1 规范: scope/parentSegment/cuid__safeName)
  const cuid = randomBytes(12).toString('base64url');
  const safeName = input.name.replace(/[\\/]/g, '_');
  const finalKey = `${scope}/${parentSegment}/${cuid}__${safeName}`;

  // init multipart, 拿 uploadId
  const storage = getStorage();
  let init;
  try {
    init = await storage.initMultipartUpload(finalKey, input.mimeType ?? undefined);
  } catch (e) {
    // init 失败: 清 session, 不留半成品
    await prisma.uploadSession.delete({ where: { id: session.id } }).catch(() => {});
    throw e;
  }

  // 每 part 一个预签名 PUT URL (30 分钟有效, 适配 1GB+ 大文件慢慢传)
  const urlExpires = 1800;
  const partUrls: Array<{ partNumber: number; putUrl: string }> = [];
  for (let i = 1; i <= totalChunks; i++) {
    const putUrl = await storage.createPresignedPutUrl(finalKey, init.uploadId, i, urlExpires);
    partUrls.push({ partNumber: i, putUrl });
  }

  // 回写 session: ossUploadId, ossKey, mode 已设
  await prisma.uploadSession.update({
    where: { id: session.id },
    data: { ossUploadId: init.uploadId, ossKey: finalKey },
  });

  return {
    session: { ...session, ossUploadId: init.uploadId, ossKey: finalKey },
    partUrls,
    finalKey,
    scope,
  };
}

/** 取一个 session (含鉴权). 不存在 / 不归当前用户 → null */
export async function getSessionForUser(userId: string, sessionId: string) {
  const s = await prisma.uploadSession.findUnique({ where: { id: sessionId } });
  if (!s) return null;
  if (s.ownerId !== userId) return null;
  return s;
}

/** 标记 chunk N 已收到, 返回更新后的 mask + 已收数 */
export async function markChunkReceived(sessionId: string, chunkIndex: number, totalChunks: number) {
  const s = await prisma.uploadSession.findUnique({ where: { id: sessionId } });
  if (!s) return null;
  const mask = parseReceivedMask(s.receivedMask, totalChunks);
  if (chunkIndex < 0 || chunkIndex >= totalChunks) {
    throw new Error(`chunk index out of range: ${chunkIndex}`);
  }
  mask[chunkIndex] = true;
  await prisma.uploadSession.update({
    where: { id: sessionId },
    data: { receivedMask: serializeReceivedMask(mask) },
  });
  return { mask, received: countReceived(mask) };
}

/** 标记 session 完成 (status=completed) */
export async function markSessionCompleted(sessionId: string) {
  await prisma.uploadSession.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  });
}

/** 标记 session 取消 */
export async function markSessionAborted(sessionId: string) {
  await prisma.uploadSession.update({
    where: { id: sessionId },
    data: { status: 'aborted' },
  });
}

/** 列当前用户的 active sessions (默认 uploading) */
export async function listActiveSessions(userId: string) {
  return prisma.uploadSession.findMany({
    where: { ownerId: userId, status: 'uploading' },
    orderBy: { updatedAt: 'desc' },
  });
}

/** 清理某 session 的 staging chunks (从 storage 物理删除) */
export async function cleanupStaging(storageKey: string) {
  // storageKey 形如 `<scope>/staging/<id>/file`, chunks 在 `<scope>/staging/<id>/chunks/*`
  const slash = storageKey.lastIndexOf('/');
  const chunksDir = storageKey.slice(0, slash) + '/chunks';
  // 删除 staging 目录里所有东西 (用 storage.delete 逐个; 简单起见不要求 driver 支持目录)
  // 先尝试拼常见 index: 0..N-1; 删到第一个不存在的为止
  const storage = getStorage();
  // 用 size 探测 N: 0..N 一直 size>0 直到第一个 0
  // 简化: 上限 10000 chunks (50MB * 10000 = 500GB, 远超 10GB 上限)
  for (let i = 0; i < 10000; i++) {
    const exists = await storage.exists(`${chunksDir}/${i}`);
    if (!exists) break;
    await storage.delete(`${chunksDir}/${i}`);
  }
  // 删 staging file (如果存在)
  await storage.delete(storageKey).catch(() => {});
}

// ============================================================
// Admin 旁路 (M3) - 仅 admin 调用, 已 requireAdmin 守门
// ============================================================

/**
 * 列出所有用户 + 各自统计 (admin 用).
 * 包含: id, email, name, isAdmin, banned, 文件数 (私人), 私人总用量 (字节), quotaBytes, createdAt
 */
export async function listUsersWithStats() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isAdmin: true,
      banned: true,
      quotaBytes: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  // 统计每个用户的私人文件数 + 总用量
  const stats = await prisma.file.groupBy({
    by: ['ownerId'],
    where: { isShared: false, isDir: false, ownerId: { not: null } },
    _count: { _all: true },
    _sum: { size: true },
  });
  const byOwner = new Map<string | null, { fileCount: number; totalSize: bigint }>();
  for (const s of stats) {
    byOwner.set(s.ownerId, { fileCount: s._count._all, totalSize: BigInt(s._sum.size ?? 0) });
  }
  return users.map((u) => {
    const s = byOwner.get(u.id);
    return {
      ...u,
      // quotaBytes 是 BigInt, 无法 JSON.stringify, 转字符串
      quotaBytes: u.quotaBytes.toString(),
      fileCount: s?.fileCount ?? 0,
      totalSize: (s?.totalSize ?? 0n).toString(),
    };
  });
}

/**
 * Admin 全局列文件 (支持 ownerId/isShared/q/parentId 过滤).
 * - 不分页, 单用户场景数据量不大. 后续量大可加 cursor pagination.
 */
export async function listAllFilesForAdmin(filters: {
  ownerId?: string | null;
  isShared?: boolean;
  q?: string;
  parentId?: string | null;
  limit?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.ownerId !== undefined) where.ownerId = filters.ownerId;
  if (filters.isShared !== undefined) where.isShared = filters.isShared;
  if (filters.parentId !== undefined) where.parentId = filters.parentId;
  if (filters.q) where.name = { contains: filters.q };
  const rows = await prisma.file.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: filters.limit ?? 200,
  });
  return rows.map(toSerializable);
}

/**
 * Admin 取单个 file (无视 ownerId). 配合 requireAdmin 守门.
 */
export async function getFileAsAdmin(fileId: string) {
  return prisma.file.findUnique({ where: { id: fileId } });
}
