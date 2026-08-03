/**
 * 公开分享页面客户端组件 (polished UI)
 *
 * 流程:
 *   - 文件夹: 进页面就拉顶层 children 显示 (无需密码, 仅展示)
 *   - 下载: 需要 downloadToken
 *     - 无密码: 点击直接 fetch access (空 body) 拿 token, 跳转
 *     - 有密码: 弹输入框, 提交后 fetch access, 拿 token, 跳转
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download, Lock, AlertTriangle, Clock, Eye, FileX, ShieldOff,
  PackageOpen, FolderOpen, Sparkles, KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileTypeBadge, getFileTypeStyle } from '@/components/pan/file-type-badge';
import { InlinePreview } from '@/components/pan/file-preview';
import { getPreviewKind } from '@/lib/preview';

interface ShareMeta {
  hasPassword: boolean;
  allowDownload: boolean;
  expiresAt: string | null;
  expired: boolean;
  accessCount: number;
}

interface FileMeta {
  id: string;
  name: string;
  size: string;
  isDir: boolean;
  mimeType: string | null;
}

interface ChildItem {
  id: string;
  name: string;
  size: string;
  isDir: boolean;
}

function formatSize(bytes: string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '永不过期';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 决定是否显示预览: 文件可预览 + (无密码 OR 已拿到 token) */
function canShowPreview(
  mime: string | null,
  name: string,
  hasPassword: boolean,
  accessToken: string | null,
): boolean {
  if (!getPreviewKind(mime, name)) return false;
  if (hasPassword && !accessToken) return false;
  return true;
}

function buildPreviewUrl(token: string, accessToken: string | null): string {
  return accessToken
    ? `/api/pan/public-share/${token}/preview?token=${encodeURIComponent(accessToken)}`
    : `/api/pan/public-share/${token}/preview`;
}

export function ShareView({
  token,
  shareMeta,
  file,
}: {
  token: string;
  shareMeta: ShareMeta;
  file: FileMeta | null;
}) {
  const [children, setChildren] = useState<ChildItem[] | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [password, setPassword] = useState('');
  const [showPwdInput, setShowPwdInput] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // 已拿到的 downloadToken (密码保护分享在 unlock 后才有, 用于预览)
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const style = useMemo(
    () => (file ? getFileTypeStyle(file.name, file.mimeType, file.isDir) : null),
    [file],
  );

  // 文件夹: 加载顶层 children
  useEffect(() => {
    if (!file?.isDir) return;
    setLoadingChildren(true);
    fetch(`/api/pan/public-share/${token}?tree=1`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => { if (j.data?.children) setChildren(j.data.children); })
      .catch(() => {})
      .finally(() => setLoadingChildren(false));
  }, [token, file?.isDir]);

  // 文件已删除
  if (!file) return <MissingState />;

  // 分享已过期
  if (shareMeta.expired) return <ExpiredState expiresAt={shareMeta.expiresAt} />;

  if (!style) return null;

  /** 获取 downloadToken 后触发下载 (同时存到 state 给预览用) */
  async function fetchDownloadToken(pwd?: string): Promise<string | null> {
    const r = await fetch(`/api/pan/public-share/${token}/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pwd ? { password: pwd } : {}),
    });
    const j = await r.json();
    if (!r.ok) {
      toast.error(j.error ?? '验证失败');
      return null;
    }
    const dt = j.data?.downloadToken ?? null;
    if (dt) setAccessToken(dt);
    return dt;
  }

  async function handleDownload() {
    if (shareMeta.hasPassword) {
      setShowPwdInput(true);
      return;
    }
    if (!shareMeta.allowDownload) {
      toast.error('该分享不允许下载');
      return;
    }
    setVerifying(true);
    try {
      const dt = await fetchDownloadToken();
      if (dt) {
        window.location.href = `/api/pan/public-share/${token}/download?token=${encodeURIComponent(dt)}`;
      }
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setVerifying(true);
    try {
      const dt = await fetchDownloadToken(password);
      if (dt) {
        setShowPwdInput(false);
        window.location.href = `/api/pan/public-share/${token}/download?token=${encodeURIComponent(dt)}`;
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fade-up px-4 pb-16">
      {/* 顶部: brand + 来源标识 */}
      <div className="mb-6 flex items-center justify-center gap-2 text-xs text-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" />
        <span>通过 云盘 分享</span>
      </div>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-sm">
        {/* 背景装饰: 大色块从右上角淡入 */}
        <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full ${style.bg} opacity-50 blur-2xl`} />
        <div className={`pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full ${style.bg} opacity-30 blur-2xl`} />

        <div className="relative p-8">
          {/* 类型徽章 (大) */}
          <div className="mb-5 flex items-center gap-4">
            <FileTypeBadge name={file.name} mime={file.mimeType} isDir={file.isDir} size="xl" />
            <div className="min-w-0 flex-1">
              <div className={`text-xs font-medium ${style.fg}`}>{style.label}</div>
              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight" title={file.name}>
                {file.name}
              </h1>
            </div>
          </div>

          {/* Meta pills */}
          <div className="flex flex-wrap items-center gap-2">
            {!file.isDir && (
              <MetaPill icon={<span className="text-xs">⏱</span>}>{formatSize(file.size)}</MetaPill>
            )}
            {file.mimeType && !file.isDir && (
              <MetaPill>
                <span className="font-mono text-[10px]">{file.mimeType}</span>
              </MetaPill>
            )}
            {file.isDir && (
              <MetaPill>
                <PackageOpen className="h-3 w-3" />
                <span>{loadingChildren ? '…' : children?.length ?? '?'} 个顶层项</span>
              </MetaPill>
            )}
            <MetaPill icon={<Clock className="h-3 w-3" />}>
              {formatDate(shareMeta.expiresAt)}
            </MetaPill>
            <MetaPill icon={<Eye className="h-3 w-3" />}>
              {shareMeta.accessCount} 次访问
            </MetaPill>
            {shareMeta.hasPassword && (
              <MetaPill icon={<Lock className="h-3 w-3" />} accent>
                需要密码
              </MetaPill>
            )}
          </div>

          {/* 密码输入 (有密码时显示) */}
          {showPwdInput && (
            <form
              onSubmit={handleSubmitPassword}
              className="mt-6 flex gap-2 rounded-lg border border-border/40 bg-bg/40 p-3"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                <KeyRound className="h-4 w-4" />
              </div>
              <Input
                type="password"
                placeholder="请输入分享密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" disabled={verifying || !password} size="sm">
                {verifying ? '验证中…' : '下载'}
              </Button>
            </form>
          )}

          {/* 下载按钮 */}
          {!showPwdInput && shareMeta.allowDownload && (
            <div className="mt-6 flex">
              <Button
                onClick={handleDownload}
                disabled={verifying}
                size="lg"
                className="group flex-1 gap-2 text-base shadow-sm"
              >
                <Download className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
                {verifying ? '准备中…' : file.isDir ? '下载整个文件夹 (zip)' : '下载文件'}
              </Button>
            </div>
          )}

          {!shareMeta.allowDownload && (
            <div className="mt-6 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span>分享者设置了"仅查看", 暂不提供下载</span>
            </div>
          )}
        </div>
      </div>

      {/* 图片/PDF 内联预览 (无需密码分享直接显示, 密码分享在 unlock 后才显示) */}
      {!file.isDir && canShowPreview(file.mimeType, file.name, shareMeta.hasPassword, accessToken) && (
        <div className="mt-6">
          <InlinePreview
            file={file}
            previewUrl={buildPreviewUrl(token, accessToken)}
            downloadUrl="#"
            downloadOnClick={() => handleDownload()}
          />
        </div>
      )}

      {/* 文件夹内容列表 */}
      {file.isDir && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 px-1">
            <FolderOpen className="h-4 w-4 text-text-muted" />
            <h2 className="text-sm font-medium">文件夹内容</h2>
            <span className="text-xs text-text-muted">
              ({loadingChildren ? '加载中' : `${children?.length ?? 0} 项`})
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/40 bg-surface shadow-sm">
            {loadingChildren ? (
              <div className="p-6 text-center text-sm text-text-muted">加载中…</div>
            ) : !children || children.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className="mx-auto h-8 w-8 text-text-faint" />
                <p className="mt-2 text-sm text-text-muted">空文件夹</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/30">
                {children.map((c) => (
                  <ChildRow key={c.id} item={c} />
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 px-1 text-xs leading-relaxed text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              仅展示顶层文件, 下载时会在服务端打包整个文件夹为 zip
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- 子组件 ---------- */

function MetaPill({
  children, icon, accent = false,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${
        accent
          ? 'border-accent/30 bg-accent/10 text-accent'
          : 'border-border/40 bg-bg/40 text-text-muted'
      }`}
    >
      {icon}
      {children}
    </span>
  );
}

function ChildRow({ item }: { item: ChildItem }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/40">
      <FileTypeBadge name={item.name} mime={null} isDir={item.isDir} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm" title={item.name}>
          {item.name}
        </div>
      </div>
      <div className="shrink-0 text-xs tabular-nums text-text-muted">
        {item.isDir ? '—' : formatSize(item.size)}
      </div>
    </li>
  );
}

function ExpiredState({ expiresAt }: { expiresAt: string | null }) {
  return (
    <div className="mx-auto mt-12 max-w-md px-4">
      <div className="rounded-2xl border border-border/40 bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
          <ShieldOff className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">分享已过期</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          该分享已于
          <br />
          <span className="font-mono text-xs">{formatDate(expiresAt)}</span>
          <br />
          到期, 无法继续访问.
        </p>
      </div>
    </div>
  );
}

function MissingState() {
  return (
    <div className="mx-auto mt-12 max-w-md px-4">
      <div className="rounded-2xl border border-border/40 bg-surface p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800/60 dark:text-stone-400">
          <FileX className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-lg font-semibold">文件已删除</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">
          分享者已删除该文件, 链接失效.
        </p>
      </div>
    </div>
  );
}
