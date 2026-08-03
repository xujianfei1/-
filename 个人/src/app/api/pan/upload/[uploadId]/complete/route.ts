/**
 * POST /api/pan/upload/[uploadId]/complete
 * Body: 无
 * Response: { data: FileItem } (201) for normal upload
 *          { data: { created: number, rootId: string } } (201) for zip upload
 *
 * 校验所有 chunk 收齐 → storage.concat 拼到最终路径
 *   - 普通文件: 建 File 记录
 *   - zip 压缩包: 解压到目标目录, 还原目录结构
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import {
  getSessionForUser,
  parseReceivedMask,
  countReceived,
  markSessionCompleted,
  cleanupStaging,
  createFileRecord,
  createDirRecord,
  ForbiddenError,
} from '@/lib/pan-queries';
import { getStorage } from '@/lib/storage';
import { prisma } from '@/lib/prisma';
import { unzipSync, type Unzipped } from 'fflate';
import { randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type RouteContext = { params: Promise<{ uploadId: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
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

  const mask = parseReceivedMask(s.receivedMask, s.totalChunks);
  const received = countReceived(mask);
  if (received !== s.totalChunks) {
    return NextResponse.json(
      {
        error: `还有 ${s.totalChunks - received} 个 chunk 未收到`,
        data: {
          received,
          totalChunks: s.totalChunks,
          missing: mask.map((v, i) => (v ? null : i)).filter((x) => x !== null),
        },
      },
      { status: 400 },
    );
  }

  const storage = getStorage();

  if (s.isZip) {
    return completeZipUpload(userId, s, storage);
  }
  return completeRegularUpload(userId, s, storage);
}

async function completeRegularUpload(
  userId: string,
  s: NonNullable<Awaited<ReturnType<typeof getSessionForUser>>>,
  storage: ReturnType<typeof getStorage>,
) {
  // 拼接所有 chunk 到最终 storageKey
  const scope = s.isShared ? 'shared' : userId;
  const parentSegment = s.parentId ?? 'root';
  const cuid = randomBytes(12).toString('base64url');
  const safeName = s.fileName.replace(/[\\/]/g, '_');
  const finalKey = `${scope}/${parentSegment}/${cuid}__${safeName}`;
  const chunksDir = s.storageKey.replace(/\/file$/, '/chunks');
  const chunkKeys: string[] = [];
  for (let i = 0; i < s.totalChunks; i++) chunkKeys.push(`${chunksDir}/${i}`);

  try {
    await storage.concat(chunkKeys, finalKey);
  } catch (e) {
    console.error('upload complete: concat failed:', e);
    return NextResponse.json({ error: 'chunk 拼接失败' }, { status: 500 });
  }

  // 建 File 记录
  let record;
  try {
    record = await createFileRecord(userId, {
      name: s.fileName,
      parentId: s.parentId,
      mimeType: s.mimeType || 'application/octet-stream',
      size: s.fileSize,
      storageKey: finalKey,
      isShared: s.isShared,
    });
  } catch (e) {
    await storage.delete(finalKey).catch(() => {});
    console.error('upload complete: db insert failed:', e);
    return NextResponse.json({ error: '创建文件记录失败' }, { status: 500 });
  }

  await markSessionCompleted(s.id);
  await cleanupStaging(s.storageKey).catch((e) => {
    console.warn('upload complete: cleanupStaging failed:', e);
  });

  return NextResponse.json({ data: record }, { status: 201 });
}

async function completeZipUpload(
  userId: string,
  s: NonNullable<Awaited<ReturnType<typeof getSessionForUser>>>,
  storage: ReturnType<typeof getStorage>,
) {
  // 拼 zip 到临时 key
  const scope = s.isShared ? 'shared' : userId;
  const tempKey = `${scope}/staging/${s.id}/zipfile`;
  const chunksDir = s.storageKey.replace(/\/file$/, '/chunks');
  const chunkKeys: string[] = [];
  for (let i = 0; i < s.totalChunks; i++) chunkKeys.push(`${chunksDir}/${i}`);

  try {
    await storage.concat(chunkKeys, tempKey);
  } catch (e) {
    console.error('upload complete zip: concat failed:', e);
    return NextResponse.json({ error: 'chunk 拼接失败' }, { status: 500 });
  }

  // 读取 zip 到内存
  const stream = await storage.get(tempKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const zipBuf = Buffer.concat(chunks);

  let entries: Unzipped;
  try {
    entries = unzipSync(new Uint8Array(zipBuf));
  } catch (e) {
    await storage.delete(tempKey).catch(() => {});
    console.error('upload complete zip: unzip failed:', e);
    return NextResponse.json({ error: 'zip 解压失败' }, { status: 400 });
  }

  // 解析 entries, 过滤 macOS 元数据
  type DirEntry = { path: string };
  type FileEntry = { path: string; name: string; parentPath: string; data: Uint8Array };
  const dirSet = new Set<string>();
  const fileList: FileEntry[] = [];

  for (const rawName of Object.keys(entries)) {
    const data = entries[rawName];
    if (!data) continue;
    if (rawName.includes('__MACOSX/')) continue;
    if (rawName === '.DS_Store' || rawName.endsWith('/.DS_Store')) continue;
    const normalized = rawName.replace(/\\/g, '/');
    const parts = normalized.split('/').filter((p) => p.length > 0);
    if (parts.length === 0) continue;

    if (normalized.endsWith('/')) {
      dirSet.add(parts.join('/'));
    } else {
      const dirParts = parts.slice(0, -1);
      const name = parts[parts.length - 1]!;
      const parentPath = dirParts.join('/');
      if (parentPath) dirSet.add(parentPath);
      // 0 字节文件 (.gitkeep, 空文档等) 也保留, 不跳过
      fileList.push({ path: parts.join('/'), name, parentPath, data });
    }
  }

  // 自动检测 zip 顶层目录: 所有 entry path 共有前缀
  // 如果全部以 "X/" 开头, 就把 X 作为 server 端 root 目录, 内部路径剥掉 X/
  const allPaths = [...dirSet, ...fileList.map((f) => f.path)];
  let topPrefix = '';
  if (allPaths.length > 0) {
    const firstSegments = allPaths.map((p) => p.split('/')[0]).filter((s): s is string => !!s);
    if (firstSegments.length > 0) {
      const candidate = firstSegments[0]!;
      if (firstSegments.every((s) => s === candidate)) {
        topPrefix = candidate;
      }
    }
  }

  // 剥掉 topPrefix 后, 重新分类
  const strippedDirs = new Set<string>();
  const strippedFiles: FileEntry[] = [];
  const strip = (p: string) => (topPrefix && p.startsWith(topPrefix + '/') ? p.slice(topPrefix.length + 1) : p);

  for (const d of dirSet) {
    const s = strip(d);
    if (s) strippedDirs.add(s);
  }
  for (const f of fileList) {
    const newPath = strip(f.path);
    if (!newPath) continue; // 是 zip 顶层目录本身
    const newParts = newPath.split('/');
    const name = newParts[newParts.length - 1]!;
    const parentPath = newParts.slice(0, -1).join('/');
    strippedFiles.push({ path: newPath, name, parentPath, data: f.data });
  }

  // 目录路径 → fileId 缓存. 顶层 = s.fileName 去掉 .zip 后缀
  const rootName = s.fileName.replace(/\.zip$/i, '');
  const dirIdMap = new Map<string, string>();

  let rootId: string;
  try {
    const root = await createDirRecord(userId, { name: rootName, parentId: s.parentId, isShared: s.isShared });
    rootId = root.id;
    dirIdMap.set('', rootId);
  } catch (e) {
    await storage.delete(tempKey).catch(() => {});
    console.error('upload complete zip: create root dir failed:', e);
    return NextResponse.json({ error: '创建根目录失败' }, { status: 500 });
  }

  // 排序: 路径短→长 (父目录先), 同长度按字母
  const dirList = [...strippedDirs].sort((a, b) => a.length - b.length || a.localeCompare(b));
  for (const dirPath of dirList) {
    const parts = dirPath.split('/');
    const dirName = parts[parts.length - 1]!;
    const parentPath = parts.slice(0, -1).join('/');
    const parentId = dirIdMap.get(parentPath);
    if (!parentId) {
      console.warn(`upload complete zip: no parent for dir ${dirPath}, skipping`);
      continue;
    }
    try {
      const f = await createDirRecord(userId, { name: dirName, parentId, isShared: s.isShared });
      dirIdMap.set(dirPath, f.id);
    } catch {
      // 重名 (目录已存在) → 查已有
      const existing = await prisma.file.findFirst({
        where: { parentId, name: dirName, isDir: true, isShared: s.isShared },
      });
      if (existing) dirIdMap.set(dirPath, existing.id);
    }
  }

  // 写文件
  let createdCount = 0;
  for (const f of strippedFiles) {
    const parentId = dirIdMap.get(f.parentPath);
    if (!parentId) {
      console.warn(`upload complete zip: no parent for ${f.path}, skipping`);
      continue;
    }
    const fileKey = `${scope}/${s.parentId ?? 'root'}/${rootId}/${randomBytes(12).toString('base64url')}__${f.name}`;
    try {
      await storage.put(fileKey, Buffer.from(f.data));
    } catch (e) {
      console.warn(`upload complete zip: storage put failed for ${f.path}:`, e);
      continue;
    }
    try {
      await createFileRecord(userId, {
        name: f.name,
        parentId,
        mimeType: 'application/octet-stream',
        size: BigInt(f.data.length),
        storageKey: fileKey,
        isShared: s.isShared,
      });
      createdCount++;
    } catch (e) {
      await storage.delete(fileKey).catch(() => {});
      console.warn(`upload complete zip: db insert failed for ${f.path}:`, e);
    }
  }

  // 清理 zip temp + staging
  await storage.delete(tempKey).catch(() => {});
  await markSessionCompleted(s.id);
  await cleanupStaging(s.storageKey).catch((e) => {
    console.warn('upload complete zip: cleanupStaging failed:', e);
  });

  return NextResponse.json(
    { data: { created: createdCount, rootId, rootName } },
    { status: 201 },
  );
}
