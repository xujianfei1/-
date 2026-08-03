/**
 * 文件列表 + 工具栏
 * - 列表当前目录
 * - 工具栏: 新建文件夹, 上传文件, 上传文件夹 (保留子目录结构)
 * - 大文件 / 任意文件: 走直传 OSS multipart (5MB/part, 3 并发, 不经 next-server)
 *   - 大文件优势: 省 ECS 带宽, 大文件不卡
 *   - 小文件: 1 个 part 走 multipart, 跟单次上传一样简单
 *   - 支持断点续传: 刷新页面 / 关闭浏览器, 未完成 session 列在"未完成的上传"里,
 *     点"继续"重新选同一个文件, 客户端调 /direct/refresh 拿 OSS 已传 part, 只补缺失
 * - 文件夹上传: 客户端 fflate 打包成 zip, 走老的 chunked proxy (直传暂不支持 zip)
 * - 顶部"未完成的上传"栏: 列出 active sessions, 点"继续"接着传
 */
'use client';

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { zipSync } from 'fflate';
import { ChevronRight, Home, Plus, Upload, FolderPlus, FolderUp, X, RefreshCw, Link2, Users, Cloud, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileRow } from './file-row';
import { ShareDialog } from './share-dialog';
import { SharesPanel } from './shares-panel';
import { FilePreviewModal } from './file-preview';

interface FileItem {
  id: string;
  ownerId: string | null;
  parentId: string | null;
  name: string;
  mimeType: string | null;
  size: string;
  storageKey: string | null;
  isDir: boolean;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UploadSession {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string | null;
  chunkSize: number;
  totalChunks: number;
  received: number;
  receivedMask: boolean[];
  ossReceived?: number[] | null; // direct 模式: OSS 已收到的 part number 列表
  mode?: 'proxy' | 'direct';
  ossKey?: string | null;
  parentId: string | null;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

function formatSpeed(bps: number): string {
  if (bps >= 1024 * 1024) return `${(bps / 1024 / 1024).toFixed(1)} MB/s`;
  if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
  return `${bps.toFixed(0)} B/s`;
}
function formatEta(sec: number): string {
  if (sec <= 0 || !isFinite(sec)) return '剩 几秒';
  if (sec < 60) return `剩 ${Math.ceil(sec)} 秒`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return s > 0 ? `剩 ${m} 分 ${s} 秒` : `剩 ${m} 分钟`;
}
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function fetchFiles(scope: 'private' | 'shared', parentId: string | null, q?: string): Promise<FileItem[]> {
  const u = new URL('/api/pan/files', window.location.origin);
  if (parentId) u.searchParams.set('parentId', parentId);
  u.searchParams.set('scope', scope);
  if (q) u.searchParams.set('q', q);
  const r = await fetch(u, { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '加载失败');
  return j.data as FileItem[];
}

async function fetchActiveSessions(): Promise<UploadSession[]> {
  const r = await fetch('/api/pan/uploads', { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '加载未完成上传失败');
  return j.data as UploadSession[];
}

async function abortSession(uploadId: string): Promise<void> {
  const r = await fetch(`/api/pan/upload/${uploadId}`, { method: 'DELETE' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || '取消失败');
  }
}

async function createFolder(body: { name: string; parentId: string | null; isShared: boolean }): Promise<FileItem> {
  const r = await fetch('/api/pan/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '创建失败');
  return j.data as FileItem;
}

async function deleteFile(id: string): Promise<void> {
  const r = await fetch(`/api/pan/files/${id}`, { method: 'DELETE' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || '删除失败');
  }
}

async function renameFile(id: string, name: string): Promise<void> {
  const r = await fetch(`/api/pan/files/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || '重命名失败');
  }
}

// ============================================================
// 上次未完成的文件 (跨刷新保留)
// File 对象不能存 sessionStorage, 只存元数据. 重试时弹文件选择器
// 让用户重新选, 校验 name+size 匹配后重传. 配合 in-memory 的
// lastFailedRef 实现: 页内即时重试 (无重选) + 跨刷新重试 (重选).
// ============================================================
const PENDING_RETRY_KEY = 'pan:lastFailed:v1';

interface FailedFileMeta {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

function loadPendingMeta(): FailedFileMeta[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(PENDING_RETRY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is FailedFileMeta =>
        x && typeof x.name === 'string' && typeof x.size === 'number',
    );
  } catch {
    return [];
  }
}

function savePendingMeta(meta: FailedFileMeta[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (meta.length === 0) sessionStorage.removeItem(PENDING_RETRY_KEY);
    else sessionStorage.setItem(PENDING_RETRY_KEY, JSON.stringify(meta));
  } catch {}
}

function clearPendingMeta(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_RETRY_KEY);
  } catch {}
}

// ============================================================
// 分块上传 (M2)
// 分块仅给 zip 上传 + 老 session 续传用, 普通文件走 M3 直传 OSS.
// ============================================================

const CHUNKED_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const CHUNKED_CONCURRENCY = 3; // 单文件内 chunk 并发
const FILE_CONCURRENCY = 3; // 多文件并发

interface ChunkedStartResult {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  receivedMask: boolean[];
}

async function chunkedStart(
  file: File,
  parentId: string | null,
  isShared: boolean,
  isZip = false,
): Promise<ChunkedStartResult | { error: string }> {
  const r = await fetch('/api/pan/upload/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
      chunkSize: CHUNKED_CHUNK_SIZE,
      parentId,
      isShared,
      isZip,
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    if (j.code === 'QUOTA_EXCEEDED') return { error: '配额已满' };
    return { error: j.error || `HTTP ${r.status}` };
  }
  return j.data as ChunkedStartResult;
}

async function chunkedPutChunk(
  uploadId: string,
  index: number,
  blob: Blob,
  activeXhrs: Set<XMLHttpRequest>,
  onPartProgress?: (loaded: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    activeXhrs.add(xhr);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPartProgress?.(e.loaded);
    };
    xhr.onload = () => {
      activeXhrs.delete(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
        return;
      }
      let msg = `HTTP ${xhr.status}`;
      try {
        const j = JSON.parse(xhr.responseText);
        if (j.error) msg = j.error;
      } catch {}
      resolve({ ok: false, error: msg });
    };
    xhr.onerror = () => {
      activeXhrs.delete(xhr);
      resolve({ ok: false, error: '网络错误' });
    };
    xhr.onabort = () => {
      activeXhrs.delete(xhr);
      resolve({ ok: false, error: '已取消' });
    };
    xhr.open('PUT', `/api/pan/upload/${uploadId}/chunk/${index}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(blob);
  });
}

async function chunkedComplete(uploadId: string): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await fetch(`/api/pan/upload/${uploadId}/complete`, { method: 'POST' });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: j.error || `HTTP ${r.status}` };
  return { ok: true, data: j.data };
}

// ============================================================
// 直传 OSS multipart (M3 大文件优化)
//
// 客户端直接 PUT 到 OSS, 不经 next-server, 节省 ECS 带宽.
// v2: 支持断点续传. 调用 uploadDirect(file, ..., resumeInfo) 时, 先调
//     /direct/refresh 拿 ossReceived (etag) + 缺失 part 的新签名 URL, 跳过已传.
// ============================================================

const DIRECT_PART_SIZE = 5 * 1024 * 1024; // 5MB
const DIRECT_CONCURRENCY = 3; // 单文件内 part 并发

interface DirectStartResult {
  uploadId: string;
  fileKey: string;
  partSize: number;
  totalParts: number;
  parts: Array<{ partNumber: number; putUrl: string }>;
}

interface DirectPartResult {
  partNumber: number;
  etag: string;
}

interface DirectRefreshResult {
  uploadId: string;
  fileKey: string;
  fileName: string;
  fileSize: string;
  chunkSize: number;
  totalParts: number;
  received: DirectPartResult[]; // OSS 端已收到的 part
  missing: Array<{ partNumber: number; putUrl: string }>;
}

async function directStart(
  file: File,
  parentId: string | null,
  isShared: boolean,
): Promise<DirectStartResult | { error: string }> {
  const r = await fetch('/api/pan/upload/direct/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      fileSize: file.size,
      mimeType: file.type || undefined,
      chunkSize: DIRECT_PART_SIZE,
      parentId,
      isShared,
    }),
  });
  const j = await r.json();
  if (!r.ok) {
    if (j.code === 'QUOTA_EXCEEDED') return { error: '配额已满' };
    if (r.status === 501) return { error: j.error || '当前存储不支持直传' };
    return { error: j.error || `HTTP ${r.status}` };
  }
  return j.data as DirectStartResult;
}

/**
 * 单个 part 直接 PUT 到 OSS. 失败时返错让上层整文件重传 (v1 不做 per-part 重试/resume).
 * ETag 来自 response header, OSS 通常带引号 (如 "abc123"), 原样传回 server 即可.
 *
 * URL 有效期 30min, 正常上传 1GB+ 都够. 真过期了就整文件重传, 不做 refresh.
 */
async function directPutPart(
  part: { partNumber: number; putUrl: string },
  blob: Blob,
  activeControllers: Set<AbortController>,
  controllerToUploadId: WeakMap<AbortController, string>,
  uploadId: string,
  onPartProgress?: (loaded: number) => void,
): Promise<{ ok: boolean; etag?: string; error?: string }> {
  const controller = new AbortController();
  activeControllers.add(controller);
  controllerToUploadId.set(controller, uploadId);
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const onAbort = () => xhr.abort();
    controller.signal.addEventListener('abort', onAbort);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPartProgress?.(e.loaded);
    };
    xhr.onload = () => {
      controller.signal.removeEventListener('abort', onAbort);
      activeControllers.delete(controller);
      controllerToUploadId.delete(controller);
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader('ETag') || xhr.getResponseHeader('etag') || '';
        if (!etag) {
          resolve({ ok: false, error: 'OSS 未返回 ETag' });
          return;
        }
        resolve({ ok: true, etag });
        return;
      }
      let msg = `HTTP ${xhr.status}`;
      try {
        const j = JSON.parse(xhr.responseText);
        if (j.error) msg = j.error;
      } catch {}
      resolve({ ok: false, error: msg });
    };
    xhr.onerror = () => {
      controller.signal.removeEventListener('abort', onAbort);
      activeControllers.delete(controller);
      controllerToUploadId.delete(controller);
      resolve({ ok: false, error: '网络错误' });
    };
    xhr.onabort = () => {
      controller.signal.removeEventListener('abort', onAbort);
      activeControllers.delete(controller);
      controllerToUploadId.delete(controller);
      resolve({ ok: false, error: '已取消' });
    };
    xhr.open('PUT', part.putUrl);
    xhr.send(blob);
  });
}

async function directComplete(
  uploadId: string,
  parts: DirectPartResult[],
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  const r = await fetch(`/api/pan/upload/${uploadId}/direct/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: j.error || `HTTP ${r.status}` };
  return { ok: true, data: j.data };
}

/**
 * 续传前置: 拿 OSS 已收到的 part (含 etag) + 缺失 part 的新签名 URL.
 * 用于直传断点续传. proxy 模式不走这个.
 */
async function directRefresh(
  uploadId: string,
): Promise<{ ok: boolean; error?: string; data?: DirectRefreshResult }> {
  const r = await fetch(`/api/pan/upload/${uploadId}/direct/refresh`, { method: 'POST' });
  const j = await r.json();
  if (!r.ok) return { ok: false, error: j.error || `HTTP ${r.status}` };
  return { ok: true, data: j.data as DirectRefreshResult };
}

/**
 * 直传一个文件. 所有 part 并发 PUT 到 OSS, 完成后调 complete.
 * 失败原因通过返回值 (不 throw). 进度: 累计已完成的 part 字节数.
 *
 * 续传: 传 resumeUploadId 进来, 先调 /direct/refresh 拿 OSS 已上传 part + 缺失 part URL,
 *       跳过已传, 只 PUT 缺失的. 最后 complete 阶段要把 received + 新传的 etag 一起传回.
 */
async function uploadDirect(
  file: File,
  parentId: string | null,
  isShared: boolean,
  onProgress: (loaded: number, total: number) => void,
  activeControllers: Set<AbortController>,
  controllerToUploadId: WeakMap<AbortController, string>,
  resumeUploadId?: string,
): Promise<{ ok: boolean; error?: string; data?: unknown; uploadId?: string }> {
  // 拿 part 列表 + uploadId (新传或续传)
  let uploadId: string;
  let partSize: number;
  let totalParts: number;
  let partsToUpload: Array<{ partNumber: number; putUrl: string }>;
  // OSS 端已收到的 part (resume 时用)
  const etags = new Map<number, string>();
  let doneBytes = 0;

  if (resumeUploadId) {
    const ref = await directRefresh(resumeUploadId);
    if (!ref.ok) return { ok: false, error: ref.error, uploadId: resumeUploadId };
    uploadId = ref.data!.uploadId;
    partSize = ref.data!.chunkSize;
    totalParts = ref.data!.totalParts;
    partsToUpload = ref.data!.missing;
    // 已有 etag 直接当完成
    for (const p of ref.data!.received) {
      etags.set(p.partNumber, p.etag);
    }
    // 已传字节数 (从 part size 推; 不依赖服务端 ossReceivedSize)
    for (let i = 1; i <= totalParts; i++) {
      if (!etags.has(i)) continue;
      const start2 = (i - 1) * partSize;
      const end = Math.min(start2 + partSize, file.size);
      doneBytes += end - start2;
    }
    onProgress(doneBytes, file.size);
  } else {
    const start = await directStart(file, parentId, isShared);
    if ('error' in start) return { ok: false, error: start.error };
    uploadId = start.uploadId;
    partSize = start.partSize;
    totalParts = start.totalParts;
    partsToUpload = [...start.parts].sort((a, b) => a.partNumber - b.partNumber);
    onProgress(0, file.size);
  }

  // 已全部传完 (极端情况: 续传时发现全部 part 都在 OSS 上, 直接 complete)
  if (partsToUpload.length === 0 && etags.size === totalParts) {
    const partList: DirectPartResult[] = [];
    for (let i = 1; i <= totalParts; i++) {
      partList.push({ partNumber: i, etag: etags.get(i)! });
    }
    const c = await directComplete(uploadId, partList);
    if (!c.ok) return { ok: false, error: c.error, uploadId };
    return { ok: true, data: c.data, uploadId };
  }

  const missingSet = new Set(partsToUpload.map((p) => p.partNumber));
  let cancelled = false;
  let errorMsg: string | null = null;

  const take = (): number | null => {
    if (cancelled) return null;
    if (errorMsg) return null;
    return null; // 用 queue.pop 替代
  };

  // 简单顺序调度: 维护一个 nextIdx 走 part 列表
  let nextIdx = 0;
  const take2 = (): number => {
    if (cancelled) return -1;
    if (errorMsg) return -1;
    if (nextIdx >= partsToUpload.length) return -1;
    return nextIdx++;
  };

  // 共享已完成的 part 字节数. JS 单线程, 赋值原子, 并发安全.
  let completedBytes = 0;
  const workers: Promise<void>[] = [];
  for (let w = 0; w < DIRECT_CONCURRENCY; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = take2();
          if (i === -1) return;
          const part = partsToUpload[i]!;
          // partSize 来自服务端, 但 file 可能不一样 (resume 时浏览器让用户重新选文件)
          // 用服务端给的 partSize 和当前 file.size 算偏移
          const start2 = (part.partNumber - 1) * partSize;
          const end = Math.min(start2 + partSize, file.size);
          const blob = file.slice(start2, end);
          let currentLoaded = 0;
          const r = await directPutPart(part, blob, activeControllers, controllerToUploadId, uploadId, (loaded) => {
            currentLoaded = loaded;
            onProgress(completedBytes + currentLoaded, file.size);
          });
          if (!r.ok) {
            if (r.error === '已取消') {
              cancelled = true;
              return;
            }
            if (!errorMsg) errorMsg = `part ${part.partNumber}: ${r.error}`;
            return;
          }
          etags.set(part.partNumber, r.etag!);
          completedBytes += end - start2;
          doneBytes = completedBytes; // 同步旧字段, 兜底 (resume 时初始 doneBytes)
          onProgress(completedBytes, file.size);
        }
      })(),
    );
  }
  await Promise.all(workers);

  if (cancelled) return { ok: false, error: '已取消', uploadId };
  if (errorMsg) return { ok: false, error: errorMsg, uploadId };
  // 必须每个 partNumber 都有 etag (含 resume 跳过的)
  for (let i = 1; i <= totalParts; i++) {
    if (!etags.has(i)) return { ok: false, error: `part ${i} 缺少 ETag`, uploadId };
  }

  const partList: DirectPartResult[] = [];
  for (let i = 1; i <= totalParts; i++) {
    partList.push({ partNumber: i, etag: etags.get(i)! });
  }
  const c = await directComplete(uploadId, partList);
  if (!c.ok) return { ok: false, error: c.error, uploadId };
  return { ok: true, data: c.data, uploadId };
}

/**
 * 分块上传一个文件. progress 报告: 当前已传字节 / 总字节.
 * 失败原因通过返回值 (不再 throw, 调用方统一收集).
 * mask 用于断点续传: 已收到的 chunk 跳过.
 */
async function uploadChunked(
  file: File,
  parentId: string | null,
  isShared: boolean,
  onProgress: (loaded: number, total: number) => void,
  activeXhrs: Set<XMLHttpRequest>,
  initialMask?: boolean[],
  initialUploadId?: string,
  isZip = false,
): Promise<{ ok: boolean; error?: string; data?: unknown }> {
  let uploadId = initialUploadId;
  let chunkSize = CHUNKED_CHUNK_SIZE;
  let totalChunks: number;
  let mask: boolean[];

  if (uploadId && initialMask) {
    // resume: 复用现有 session
    totalChunks = initialMask.length;
    mask = [...initialMask];
  } else {
    // 全新上传
    const start = await chunkedStart(file, parentId, isShared, isZip);
    if ('error' in start) return { ok: false, error: start.error };
    uploadId = start.uploadId;
    chunkSize = start.chunkSize;
    totalChunks = start.totalChunks;
    mask = [...start.receivedMask];
  }

  let doneBytes = mask.reduce((sum, m, i) => {
    if (!m) return sum;
    const isLast = i === totalChunks - 1;
    return sum + (isLast ? file.size - chunkSize * (totalChunks - 1) : chunkSize);
  }, 0);
  onProgress(doneBytes, file.size);

  // 并发 N: 维护一个 next-index 游标, 每个 worker 拿到 next 就传, 然后递增
  let nextIndex = mask.findIndex((v) => !v);
  if (nextIndex === -1) nextIndex = totalChunks; // all done

  const errors: string[] = [];
  const workers: Promise<void>[] = [];
  let cancelled = false;

  // 用原子计数器推进 nextIndex
  const getNext = (): number => {
    if (cancelled) return -1;
    const i = nextIndex;
    if (i >= totalChunks) return -1;
    nextIndex = i + 1;
    return i;
  };

  // 共享已完成的 chunk 字节数. JS 单线程, 赋值原子, 并发安全.
  let completedBytes = 0;
  for (let w = 0; w < CHUNKED_CONCURRENCY; w++) {
    workers.push(
      (async () => {
        while (true) {
          const i = getNext();
          if (i === -1) return;
          if (i >= totalChunks) return;
          const start = i * chunkSize;
          const end = Math.min(start + chunkSize, file.size);
          const blob = file.slice(start, end);
          let currentLoaded = 0;
          const r = await chunkedPutChunk(uploadId!, i, blob, activeXhrs, (loaded) => {
            currentLoaded = loaded;
            onProgress(completedBytes + currentLoaded, file.size);
          });
          if (!r.ok) {
            if (r.error === '已取消') {
              cancelled = true;
              return;
            }
            errors.push(`chunk ${i}: ${r.error}`);
            return; // 任一 chunk 失败就停 (断点续传可重试)
          }
          mask[i] = true;
          completedBytes += end - start;
          doneBytes = completedBytes; // 同步旧字段, 兜底 (resume 时初始 doneBytes)
          onProgress(completedBytes, file.size);
        }
      })(),
    );
  }
  await Promise.all(workers);

  if (errors.length > 0) return { ok: false, error: errors[0] };
  if (cancelled) return { ok: false, error: '已取消' };

  // 全部 chunk 收到 → complete
  const c = await chunkedComplete(uploadId);
  if (!c.ok) return { ok: false, error: c.error };
  return { ok: true, data: c.data };
}

/** DataTransferItem.webkitGetAsEntry() → FileSystemEntry. 仅 Chrome/Edge/Safari 支持, Firefox 暂不支持 folder drop. */
interface FsEntryWithFile extends FileSystemEntry {
  file(successCallback: (file: File) => void, errorCallback?: (err: DOMException) => void): void;
}

/** 递归把 FileSystemEntry 树拍平成 File[], 给每个 file 加上 webkitRelativePath 保留目录结构. */
async function walkEntry(
  entry: FileSystemEntry,
  pathPrefix: string,
  out: File[],
): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      (entry as FsEntryWithFile).file(resolve, reject);
    });
    // 重新包成 File: name 留 basename (避免带 / 的怪名字), webkitRelativePath 走 defineProperty 设 (构造器不支持)
    const relPath = pathPrefix + entry.name;
    const wrapped = new File([file], entry.name, { type: file.type, lastModified: file.lastModified });
    Object.defineProperty(wrapped, 'webkitRelativePath', { value: relPath, writable: false, configurable: false });
    out.push(wrapped);
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries 一次最多 100 条, 循环读直到空数组
    const collectAll = (): Promise<FileSystemEntry[]> => {
      return new Promise((resolve, reject) => {
        const all: FileSystemEntry[] = [];
        const readBatch = () => {
          reader.readEntries((children) => {
            if (children.length === 0) {
              resolve(all);
              return;
            }
            all.push(...children);
            readBatch();
          }, reject);
        };
        readBatch();
      });
    };
    const children = await collectAll();
    for (const child of children) {
      await walkEntry(child, pathPrefix + entry.name + '/', out);
    }
  }
}

interface Props {
  scope: 'private' | 'shared';
  folderId: string | null;
  onEnter: (id: string | null) => void;
}

interface ProgressState {
  totalBytes: number;
  uploadedBytes: number;
  totalFiles: number;
  doneFiles: number;
  currentFile: string;
}

export function FileBrowser({ scope, folderId, onEnter }: Props) {
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState(''); // 输入框即时值
  const [search, setSearch] = useState(''); // 防抖后实际查询值
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0); // dragenter/leave 嵌套触发, 用计数器配对
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const activeXhrs = useRef<Set<XMLHttpRequest>>(new Set());
  // 直传: 所有并发文件共享的 controllers 池, cancelUploads 时统一 abort
  // controllerToUploadId 用于 cancel 时反查 uploadId, 通知 server 清理 OSS multipart
  const directControllers = useRef<Set<AbortController>>(new Set());
  const directControllerToUploadId = useRef<WeakMap<AbortController, string>>(new WeakMap());
  const queryKey = ['pan', 'files', scope, folderId, search];
  const filesQ = useQuery({ queryKey, queryFn: () => fetchFiles(scope, folderId, search) });
  const sessionsQ = useQuery({
    queryKey: ['pan', 'sessions'],
    queryFn: fetchActiveSessions,
    refetchInterval: 5_000,
  });

  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string; mime: string | null; isDir: boolean } | null>(null);
  const [showSharesPanel, setShowSharesPanel] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<FileItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    totalBytes: 0,
    uploadedBytes: 0,
    totalFiles: 0,
    doneFiles: 0,
    currentFile: '',
  });
  // 实时上传速度 + 剩余时间. 100ms 刷新一次, 采样窗口 3s 算瞬时速度.
  const [speedEta, setSpeedEta] = useState<{ bps: number; etaSec: number } | null>(null);
  const speedSamples = useRef<Array<{ ts: number; bytes: number }>>([]);
  // 上次未完成的 File[] (in-memory, toast 重试按钮用)
  // File 对象在内存里直接拿, 不用再让用户选. 跨刷新靠 lastFailedMeta (sessionStorage) 保留元数据.
  const lastFailedRef = useRef<File[]>([]);
  // 上次未完成的元数据 (跨刷新 banner 用). File 不能存进 sessionStorage, 只存 name/size/type/lastModified.
  const [lastFailedMeta, setLastFailedMeta] = useState<FailedFileMeta[]>([]);

  // 挂载时读一次 sessionStorage, 跨刷新恢复 banner
  useEffect(() => {
    setLastFailedMeta(loadPendingMeta());
  }, []);

  // 防抖 300ms: 输入停止后 0.3s 才发请求
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  function cancelUploads() {
    for (const xhr of activeXhrs.current) xhr.abort();
    activeXhrs.current.clear();
    // 直传: abort 客户端在飞的 PUT, 收集 uploadId 用于通知 server 清理 OSS multipart
    const abortedUploadIds = new Set<string>();
    for (const c of directControllers.current) {
      const uploadId = directControllerToUploadId.current.get(c);
      c.abort();
      if (uploadId) abortedUploadIds.add(uploadId);
    }
    directControllers.current.clear();
    // 异步 fire-and-forget 通知 server (server 会 abort OSS multipart + 标记 session aborted)
    for (const uploadId of abortedUploadIds) {
      abortSession(uploadId).catch(() => {});
    }
    qc.invalidateQueries({ queryKey: ['pan', 'sessions'] });
    toast.info('已取消, 直传已通知 server 清理 OSS', { duration: 4000 });
  }

  // 全局禁用浏览器默认的"打开文件"行为: 拖到页面其它地方也 preventDefault,
  // 避免误操作导致浏览器直接渲染文件内容. 仅在拖文件时拦截, 文字/链接拖动不受影响.
  useEffect(() => {
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
    const onWindowDragOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onWindowDrop = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);
    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, []);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    if (!e.dataTransfer.types.includes('Files')) return;
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dragCounterRef.current > 0) {
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) setIsDragging(false);
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = uploading ? 'none' : 'copy';
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    if (uploading) {
      toast.warning('正在上传中, 请先取消或等待完成');
      return;
    }
    const dt = e.dataTransfer;
    if (!dt) return;

    // 优先用 items 探测: 能拿到 webkitGetAsEntry (Chrome/Edge) 就用它来识别文件夹.
    // Firefox 不支持 folder drop, 此时 items 为空, 退到 dt.files.
    const items = dt.items;
    const entries: FileSystemEntry[] = [];
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item || item.kind !== 'file') continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
    }

    const hasDirectory = entries.some((en) => en.isDirectory);
    const fileList = dt.files;
    if (entries.length === 0 && (!fileList || fileList.length === 0)) return;

    if (hasDirectory) {
      // 走 entry walker 收集 (含子目录)
      const collected: File[] = [];
      for (const entry of entries) {
        try {
          await walkEntry(entry, '', collected);
        } catch (err) {
          toast.error(`读取 ${entry.name} 失败: ${(err as Error).message}`);
          return;
        }
      }
      if (collected.length === 0) {
        toast.warning('没读取到任何文件 (目录可能为空)');
        return;
      }
      handleFolderUpload(collected, folderId, scope === 'shared');
    } else {
      // 纯文件: 走 handleFilesUpload (单文件不分块, 多文件并发)
      const files = fileList ? Array.from(fileList) : [];
      if (files.length === 0) return;
      handleFilesUpload(files, folderId, scope === 'shared');
    }
  }

  const createFolderMut = useMutation({
    mutationFn: createFolder,
    onSuccess: () => {
      toast.success('已创建文件夹');
      setShowNewFolder(false);
      setNewFolderName('');
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteFile,
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['pan', 'quota'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameFile(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /** 上传一个文件. 直传 OSS multipart (不走 next-server, 大小通吃).
   *  onDelta(loaded, total) 在文件内部被多次调用, 报告"本文件当前已传字节"
   *  (调用方需要把 self 增量累加到全局 uploadedBytes).
   *  resumeUploadId 不为空时走续传路径 (先 refresh 拿 OSS 已传 part, 只补缺失).
   */
  async function uploadOne(
    file: File,
    parentId: string | null,
    isShared: boolean,
    onDelta: (loaded: number, total: number) => void,
    resumeUploadId?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const tick = (loaded: number, _total: number) => onDelta(loaded, file.size);
    const r = await uploadDirect(
      file,
      parentId,
      isShared,
      tick,
      directControllers.current,
      directControllerToUploadId.current,
      resumeUploadId,
    );
    if (r.ok) onDelta(file.size, file.size);
    return { ok: r.ok, error: r.error };
  }

  /**
   * zip 整包分块上传. file 已是 zip, isZip=true 走解压逻辑.
   * 不走小文件路径 (zip 通常 > 10MB).
   */
  async function uploadChunkedWithFlag(
    file: File,
    parentId: string | null,
    isShared: boolean,
    isZip: boolean,
    onDelta: (loaded: number, total: number) => void,
  ): Promise<{ ok: boolean; error?: string; data?: unknown }> {
    let lastLoaded = 0;
    const tick = (loaded: number) => {
      const delta = loaded - lastLoaded;
      if (delta > 0) onDelta(loaded, file.size);
      lastLoaded = loaded;
    };
    const r = await uploadChunked(file, parentId, isShared, tick, activeXhrs.current, undefined, undefined, isZip);
    tick(file.size);
    return r;
  }

  /**
   * 并发跑 workers. concurrency=N 个 worker 同时从 queue 拿任务.
   * 入参: items 数组, n 并发度, 每个 item 跑 worker(item, index) 返回 Promise.
   * 收集所有 ok/error 到 results (按 items 顺序).
   */
  async function runWithConcurrency<T>(
    items: T[],
    n: number,
    worker: (item: T, idx: number) => Promise<{ ok: boolean; error?: string }>,
  ): Promise<Array<{ ok: boolean; error?: string }>> {
    const results: Array<{ ok: boolean; error?: string }> = new Array(items.length);
    let next = 0;
    const take = (): number => {
      const i = next;
      if (i >= items.length) return -1;
      next = i + 1;
      return i;
    };
    const runners: Promise<void>[] = [];
    for (let w = 0; w < Math.min(n, items.length); w++) {
      runners.push(
        (async () => {
          while (true) {
            const i = take();
            if (i === -1) return;
            const item = items[i]!;
            results[i] = await worker(item, i);
            setProgress((p) => ({ ...p, doneFiles: p.doneFiles + 1 }));
          }
        })(),
      );
    }
    await Promise.all(runners);
    return results;
  }

  async function handleFilesUpload(files: File[], parentId: string | null, isShared: boolean) {
    // 每次上传从干净 pending 开始 (新上传或重试都一样)
    lastFailedRef.current = [];
    setLastFailedMeta([]);
    clearPendingMeta();

    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    speedSamples.current = [];
    setProgress({
      totalBytes,
      uploadedBytes: 0,
      totalFiles: files.length,
      doneFiles: 0,
      currentFile: '',
    });
    setUploading(true);
    // 查 active sessions: 同名+同大小+同 parent 自动续传, 避免重试时建出重复 session
    const activeSessions = sessionsQ.data ?? [];
    const lastByFile = new Map<string, number>();
    const results = await runWithConcurrency(files, FILE_CONCURRENCY, (file) => {
      const match = activeSessions.find(
        (s) =>
          s.fileName === file.name &&
          Number(s.fileSize) === file.size &&
          s.parentId === parentId &&
          s.isShared === isShared,
      );
      return uploadOne(
        file,
        parentId,
        isShared,
        (loaded) => {
          const prev = lastByFile.get(file.name) ?? 0;
          const delta = loaded - prev;
          lastByFile.set(file.name, loaded);
          if (delta > 0) {
            setProgress((p) => ({ ...p, currentFile: file.name, uploadedBytes: p.uploadedBytes + delta }));
          }
        },
        match?.id,
      );
    });
    setProgress((p) => ({ ...p, currentFile: '' }));
    setUploading(false);
    const okCount = results.filter((r) => r.ok).length;
    const failedFiles = results
      .map((r, i) => (r.ok ? null : files[i]!))
      .filter((f): f is File => f !== null);
    const errs = results
      .map((r, i) => (r.ok ? null : `${files[i]!.name}: ${r.error || '未知错误'}`))
      .filter((x): x is string => x !== null);
    if (okCount > 0) {
      toast.success(`已上传 ${okCount} 个文件`);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['pan', 'quota'] });
    }
    if (errs.length > 0) {
      // 记录失败: in-memory (toast 重试按钮) + sessionStorage (跨刷新 banner)
      lastFailedRef.current = failedFiles;
      const meta: FailedFileMeta[] = failedFiles.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        lastModified: f.lastModified,
      }));
      setLastFailedMeta(meta);
      savePendingMeta(meta);
      // 汇总 toast 带重试按钮 (File 对象在 ref 里, 不用再选文件)
      toast.error(`${errs.length} 个文件上传失败`, {
        duration: 10000,
        action: {
          label: '重试',
          onClick: () => {
            const toRetry = lastFailedRef.current;
            if (toRetry.length > 0) {
              handleFilesUpload(toRetry, folderId, scope === 'shared');
            }
          },
        },
      });
      for (const e of errs.slice(0, 5)) toast.error(e, { duration: 10000 });
      if (errs.length > 5) toast.error(`...还有 ${errs.length - 5} 个失败`, { duration: 10000 });
    }
    // 取消/错误时 session 可能在 server 还在, 刷新 banner
    if (okCount < files.length) {
      qc.invalidateQueries({ queryKey: ['pan', 'sessions'] });
    }
  }

  async function handleFolderUpload(files: File[], rootParentId: string | null, isShared: boolean) {
    if (files.length === 0) return;
    const firstPath = files[0]?.webkitRelativePath ?? '';
    const topName = firstPath.split('/')[0] || '未命名文件夹';
    const totalUncompressed = files.reduce((s, f) => s + f.size, 0);

    // 太大不走 zip (单 zip 在内存, 2GB 上限留给解码), 直接走旧的逐文件并发
    const ZIP_LIMIT = 2 * 1024 * 1024 * 1024;
    if (totalUncompressed > ZIP_LIMIT) {
      toast.error(`文件夹太大 (${formatBytes(totalUncompressed)}), 超 2GB 暂不支持 zip 上传, 请分批`);
      return;
    }

    setProgress({
      totalBytes: 0, // zip 完后用 zip 大小更新
      uploadedBytes: 0,
      totalFiles: 1,
      doneFiles: 0,
      currentFile: `${topName}/ (打包中…)`,
    });
    setUploading(true);

    try {
      // 客户端用 fflate 打包. 顺序: 父→子 (fflate 不要求, 这里只保证路径一致)
      const entries: Record<string, Uint8Array> = {};
      const readFailures: string[] = [];
      for (const f of files) {
        const rel = (f.webkitRelativePath || f.name).replace(/\\/g, '/');
        try {
          const buf = new Uint8Array(await f.arrayBuffer());
          entries[rel] = buf;
        } catch (e) {
          // 极少发生: 浏览器读源文件失败 (文件被独占 / 浏览器无权限 / 磁盘 I/O 错)
          readFailures.push(`${rel}: ${(e as Error).message}`);
        }
      }
      if (readFailures.length > 0) {
        toast.warning(`打包阶段 ${readFailures.length}/${files.length} 个文件读取失败`, { duration: 8000 });
        console.warn('zip read failures:', readFailures);
      }
      if (Object.keys(entries).length === 0) {
        toast.error('所有文件都读取失败, 上传中止');
        setUploading(false);
        return;
      }

      const zipped = zipSync(entries, { level: 0 }); // 0 = 不压, 小文件多时不压更快

      const zipFile = new File([zipped], `${topName}.zip`, { type: 'application/zip' });

      setProgress({
        totalBytes: zipFile.size,
        uploadedBytes: 0,
        totalFiles: 1,
        doneFiles: 0,
        currentFile: `${topName}.zip`,
      });

      // 走分块上传, isZip=true
      let lastLoaded = 0;
      const r = await uploadChunkedWithFlag(
        zipFile,
        rootParentId,
        isShared,
        true,
        (loaded) => {
          const delta = loaded - lastLoaded;
          lastLoaded = loaded;
          if (delta > 0) {
            setProgress((p) => ({
              ...p,
              currentFile: `${topName}.zip`,
              uploadedBytes: p.uploadedBytes + delta,
            }));
          }
        },
      );
      setProgress((p) => ({ ...p, doneFiles: 1, currentFile: '' }));
      if (r.ok) {
        // 检查服务端实际建了多少文件, 是否少于客户端打包的数量
        const data = r.data as { created?: number; rootId?: string; rootName?: string } | undefined;
        const created = data?.created ?? files.length;
        const skipped = files.length - created;
        if (skipped > 0) {
          toast.warning(
            `文件夹 ${topName} 上传完成, ${created}/${files.length} 个文件已建, ${skipped} 个被跳过 (可能是重名冲突)`,
            { duration: 10000 },
          );
        } else {
          toast.success(`文件夹 ${topName} 上传完成 (${files.length} 个文件)`);
        }
        qc.invalidateQueries({ queryKey });
        qc.invalidateQueries({ queryKey: ['pan', 'quota'] });
      } else {
        // 区分 chunk 网络错 vs 服务端解压错
        const err = r.error || '未知错误';
        if (err.includes('zip') || err.includes('解压')) {
          toast.error(`zip 解压失败: ${err}. 服务端解析 zip 出错, 可能是传输中断, 可刷新页面在"未完成的上传"里续传`, { duration: 10000 });
        } else if (err.includes('网络') || err.includes('timeout') || err.includes('HTTP 5')) {
          toast.error(`上传失败: ${err}. 可能是网络中断, 刷新页面可在"未完成的上传"里续传`, { duration: 10000 });
        } else {
          toast.error(`${topName}.zip: ${err}`);
        }
      }
    } catch (e) {
      toast.error(`文件夹上传失败: ${(e as Error).message}`);
    } finally {
      setUploading(false);
      // session 可能还在 server (取消/部分失败), 刷新 banner 让用户能续传
      qc.invalidateQueries({ queryKey: ['pan', 'sessions'] });
    }
  }

  function handleFilePicker(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    handleFilesUpload(Array.from(list), folderId, scope === 'shared');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDirPicker(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    handleFolderUpload(Array.from(list), folderId, scope === 'shared');
    if (dirInputRef.current) dirInputRef.current.value = '';
  }

  /**
   * 续传某个 session. 重新选同一个文件 (浏览器限制: 无法直接重新读源文件),
   * 客户端按 totalChunks/chunkSize 切, 用同一 uploadId 续传.
   * - mode='direct' 走 uploadDirect (走 /direct/refresh 拿 OSS 已传 part, 只补缺失)
   * - mode='proxy' 走 uploadChunked (用 receivedMask 跳过)
   */
  async function resumeSession(s: UploadSession) {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      if (f.name !== s.fileName) {
        toast.error(`文件名不匹配: 期望 ${s.fileName}, 选了 ${f.name}`);
        return;
      }
      if (f.size !== Number(s.fileSize)) {
        toast.error(`文件大小不匹配: 期望 ${s.fileSize}, 选了 ${f.size}`);
        return;
      }
      const totalBytes = Number(s.fileSize);
      setProgress({
        totalBytes,
        uploadedBytes: 0,
        totalFiles: 1,
        doneFiles: 0,
        currentFile: s.fileName,
      });
      setUploading(true);
      let r: { ok: boolean; error?: string };
      if (s.mode === 'direct') {
        r = await uploadOne(
          f,
          s.parentId,
          s.isShared,
          (loaded) => setProgress((p) => ({ ...p, uploadedBytes: loaded })),
          s.id,
        );
      } else {
        const cr = await uploadChunked(
          f,
          s.parentId,
          s.isShared,
          (loaded) => setProgress((p) => ({ ...p, uploadedBytes: loaded })),
          activeXhrs.current,
          s.receivedMask,
          s.id,
        );
        r = { ok: cr.ok, error: cr.error };
      }
      setUploading(false);
      setProgress((p) => ({ ...p, currentFile: '' }));
      if (r.ok) {
        toast.success(`${s.fileName} 续传完成`);
        qc.invalidateQueries({ queryKey: ['pan', 'sessions'] });
        qc.invalidateQueries({ queryKey });
        qc.invalidateQueries({ queryKey: ['pan', 'quota'] });
      } else {
        toast.error(`${s.fileName}: ${r.error}`);
      }
    };
    input.click();
  }

  async function handleAbort(s: UploadSession) {
    if (!confirm(`取消上传 ${s.fileName}? 已传的 chunk 会丢失.`)) return;
    try {
      await abortSession(s.id);
      toast.success('已取消');
      qc.invalidateQueries({ queryKey: ['pan', 'sessions'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /**
   * 跨刷新 banner 的"重试": File 没了, 弹文件选择器让用户重选.
   * 校验 name+size 匹配 meta 后, 调 handleFilesUpload (会自动续传同名 active session).
   */
  function handleRetryFromPending() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = () => {
      const picked = Array.from(input.files ?? []);
      if (picked.length === 0) return;
      const matched: File[] = [];
      const unmatched: string[] = [];
      for (const meta of lastFailedMeta) {
        const f = picked.find((p) => p.name === meta.name && p.size === meta.size);
        if (f) matched.push(f);
        else unmatched.push(`${meta.name} (${formatBytes(meta.size)})`);
      }
      if (unmatched.length > 0) {
        toast.error(`未选择以下文件: ${unmatched.join(', ')}`, { duration: 10000 });
      }
      if (matched.length > 0) {
        // 同步到 ref, 万一 toast 也出现也能用
        lastFailedRef.current = matched;
        handleFilesUpload(matched, folderId, scope === 'shared');
      }
    };
    input.click();
  }

  function handleDismissPending() {
    lastFailedRef.current = [];
    setLastFailedMeta([]);
    clearPendingMeta();
  }

  // 每次字节推进时推一个采样点 (5s 窗口算瞬时速度)
  useEffect(() => {
    if (!uploading || progress.uploadedBytes === 0) return;
    const now = performance.now();
    speedSamples.current.push({ ts: now, bytes: progress.uploadedBytes });
    const cutoff = now - 5000;
    while (speedSamples.current.length > 0 && speedSamples.current[0]!.ts < cutoff) {
      speedSamples.current.shift();
    }
  }, [progress.uploadedBytes, uploading]);

  // 进度条运行中每 500ms 算一次瞬时速度 + ETA
  useEffect(() => {
    if (!uploading) {
      setSpeedEta(null);
      return;
    }
    const id = setInterval(() => {
      const samples = speedSamples.current;
      if (samples.length < 2) return;
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      const dt = (last.ts - first.ts) / 1000;
      if (dt <= 0) return;
      const db = last.bytes - first.bytes;
      const bps = db / dt;
      const remaining = Math.max(0, progress.totalBytes - progress.uploadedBytes);
      const etaSec = bps > 0 ? remaining / bps : 0;
      setSpeedEta({ bps, etaSec });
    }, 500);
    return () => clearInterval(id);
  }, [uploading, progress.totalBytes, progress.uploadedBytes]);

  const pct =
    progress.totalBytes > 0
      ? Math.min(100, (progress.uploadedBytes / progress.totalBytes) * 100)
      : 0;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/40 bg-surface shadow-sm"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 上次未完成 (跨刷新 banner) — File 对象丢了, 让用户重新选, 校验 name+size 后重传 */}
      {lastFailedMeta.length > 0 && !uploading && (
        <div className="border-b border-border/30 bg-info/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex-1 truncate text-text">
              上次未完成: {lastFailedMeta.length} 个文件
              <span className="ml-1 text-text-muted">
                (
                {lastFailedMeta
                  .slice(0, 3)
                  .map((m) => `${m.name} ${formatBytes(m.size)}`)
                  .join(', ')}
                {lastFailedMeta.length > 3 ? `, +${lastFailedMeta.length - 3}` : ''})
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={handleRetryFromPending}>
              <RefreshCw className="mr-1 h-3 w-3" />
              重试
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismissPending}>
              忽略
            </Button>
          </div>
        </div>
      )}

      {/* 未完成的上传 (断点续传) */}
      {sessionsQ.data && sessionsQ.data.length > 0 && (
        <div className="border-b border-border/30 bg-warning/10 px-3 py-2 text-xs">
          <div className="mb-1 font-medium text-text">未完成的上传 ({sessionsQ.data.length})</div>
          <ul className="space-y-1">
            {sessionsQ.data.map((s) => {
              // direct 模式: 已传字节数从 ossReceived (part 数 × partSize, 最后一段例外) 推
              // proxy 模式: 从 receivedMask 推
              let recBytes: number;
              if (s.mode === 'direct' && s.ossReceived) {
                recBytes = s.ossReceived.reduce((sum, pn) => {
                  const isLast = pn === s.totalChunks;
                  return sum + (isLast ? Number(s.fileSize) - s.chunkSize * (s.totalChunks - 1) : s.chunkSize);
                }, 0);
              } else {
                recBytes = s.receivedMask.reduce((sum, m, i) => {
                  if (!m) return sum;
                  const isLast = i === s.totalChunks - 1;
                  return sum + (isLast ? Number(s.fileSize) - s.chunkSize * (s.totalChunks - 1) : s.chunkSize);
                }, 0);
              }
              const totalBytes = Number(s.fileSize);
              const sPct = totalBytes > 0 ? (recBytes / totalBytes) * 100 : 0;
              return (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate">
                    {s.fileName}{' '}
                    <span className="text-text-muted">
                      ({formatBytes(recBytes)} / {formatBytes(totalBytes)} · {sPct.toFixed(0)}%{s.mode === 'direct' ? ' · 直传' : ''})
                    </span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => resumeSession(s)}>
                    <RefreshCw className="mr-1 h-3 w-3" />
                    继续
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAbort(s)}>
                    取消
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 p-3">
        {/* 搜索: 紧凑 input + 清空按钮 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索当前目录…"
            className="h-8 w-48 pl-8 pr-7 text-xs"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-text-muted hover:bg-bg hover:text-text"
              title="清空"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={() => onEnter(null)} disabled={folderId === null}>
          <Home className="mr-1 h-4 w-4" />
          根目录
        </Button>
        {folderId && <ChevronRight className="h-4 w-4 text-text-muted" />}
        <span className="text-xs text-text-muted">
          {search
            ? `搜索: ${search}`
            : folderId
              ? '子目录'
              : scope === 'shared'
                ? '共享池根'
                : '我的根目录'}
        </span>
        {search && filesQ.data && (
          <span className="text-xs text-text-faint">
            · 命中 {filesQ.data.length} 项
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSharesPanel(true)}
            disabled={uploading}
          >
            <Link2 className="mr-1 h-4 w-4" />
            我的分享
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowNewFolder((s) => !s)}
            disabled={uploading}
          >
            <FolderPlus className="mr-1 h-4 w-4" />
            新建文件夹
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="mr-1 h-4 w-4" />
            上传文件
          </Button>
          <Button size="sm" onClick={() => dirInputRef.current?.click()} disabled={uploading}>
            <FolderUp className="mr-1 h-4 w-4" />
            上传文件夹
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFilePicker}
            disabled={uploading}
          />
          <input
            ref={dirInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={handleDirPicker}
            disabled={uploading}
          />
        </div>
      </div>

      {uploading && (
        <div className="border-b border-border bg-accent-soft/30 px-3 py-2 text-xs">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex-1 truncate text-text">
              {progress.currentFile || '准备中…'}
            </span>
            <span className="text-text-muted">
              {progress.doneFiles}/{progress.totalFiles} ·{' '}
              {formatBytes(progress.uploadedBytes)} / {formatBytes(progress.totalBytes)} · {pct.toFixed(0)}%
              {speedEta && speedEta.bps > 0 && (
                <>
                  {' · '}{formatSpeed(speedEta.bps)}
                  {' · '}{formatEta(speedEta.etaSec)}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={cancelUploads}
              className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-text-muted hover:bg-danger/10 hover:text-danger"
              title="取消上传"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-gradient-to-r from-primary/70 via-primary to-primary/70 bg-[length:200%_100%] animate-shimmer transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* 新建文件夹表单 */}
      {showNewFolder && (
        <form
          className="flex items-center gap-2 border-b border-border bg-accent-soft/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newFolderName.trim()) return;
            createFolderMut.mutate({
              name: newFolderName.trim(),
              parentId: folderId,
              isShared: scope === 'shared',
            });
          }}
        >
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="文件夹名"
            className="max-w-xs"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={createFolderMut.isPending}>
            <Plus className="mr-1 h-4 w-4" />
            创建
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName('');
            }}
          >
            取消
          </Button>
        </form>
      )}

      {/* 列表 */}
      {filesQ.isPending ? (
        <div className="p-6 text-sm text-text-muted">加载中…</div>
      ) : filesQ.error ? (
        <div className="p-6 text-sm text-danger">{(filesQ.error as Error).message}</div>
      ) : filesQ.data && filesQ.data.length === 0 ? (
        <EmptyState scope={scope} folderId={folderId} search={search} />
      ) : (
        <ul className="divide-y divide-border">
          {filesQ.data?.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              onOpen={() => {
                if (f.isDir) {
                  onEnter(f.id);
                } else {
                  // 文件: 弹预览 (非预览类型则 fallback 到下载行为)
                  setPreviewTarget(f);
                }
              }}
              onDelete={() => {
                if (confirm(`确定删除 ${f.name}?`)) deleteMut.mutate(f.id);
              }}
              onRename={(newName) => renameMut.mutate({ id: f.id, name: newName })}
              onShare={() => setShareTarget({ id: f.id, name: f.name, mime: f.mimeType, isDir: f.isDir })}
            />
          ))}
        </ul>
      )}

      {shareTarget && (
        <ShareDialog
          fileId={shareTarget.id}
          fileName={shareTarget.name}
          fileMime={shareTarget.mime}
          fileIsDir={shareTarget.isDir}
          onClose={() => setShareTarget(null)}
        />
      )}

      {showSharesPanel && <SharesPanel onClose={() => setShowSharesPanel(false)} />}

      {previewTarget && (
        <FilePreviewModal
          file={{
            id: previewTarget.id,
            name: previewTarget.name,
            mimeType: previewTarget.mimeType,
            size: previewTarget.size,
            isDir: previewTarget.isDir,
          }}
          previewUrl={`/api/pan/preview/${previewTarget.id}`}
          downloadUrl={`/api/pan/download/${previewTarget.id}`}
          onClose={() => setPreviewTarget(null)}
          onShare={() => {
            setShareTarget({
              id: previewTarget.id,
              name: previewTarget.name,
              mime: previewTarget.mimeType,
              isDir: false,
            });
            setPreviewTarget(null);
          }}
        />
      )}

      {/* 拖放提示: 覆盖整个容器, 拖入时高亮 */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-primary">松开上传</p>
          <p className="text-xs text-text-muted">支持文件 / 文件夹 (保留目录结构)</p>
        </div>
      )}
    </div>
  );
}

function EmptyState({ scope, folderId, search }: { scope: 'private' | 'shared'; folderId: string | null; search: string }) {
  const isRoot = folderId === null;
  const inShared = scope === 'shared';
  // 搜索无结果: 跟"空" 区分开
  if (search) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg text-text-faint">
          <Search className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-sm font-medium">无匹配项</h3>
        <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-text-muted">
          当前目录没有文件名含 <span className="font-mono text-text">&quot;{search}&quot;</span> 的项
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        {inShared ? (
          <Users className="h-8 w-8" />
        ) : (
          <Cloud className="h-8 w-8" />
        )}
      </div>
      <h3 className="mt-4 text-sm font-medium">
        {isRoot
          ? inShared
            ? '共享池还是空的'
            : '还没有任何文件'
          : '空文件夹'}
      </h3>
      <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-text-muted">
        {isRoot
          ? inShared
            ? '所有用户都可以在这里上传和访问共享文件'
            : '点击工具栏 "上传文件" / "上传文件夹" 开始'
          : '把文件拖进来, 或点击工具栏上传'}
      </p>
    </div>
  );
}