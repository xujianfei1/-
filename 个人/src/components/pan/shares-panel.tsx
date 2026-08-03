/**
 * 分享管理面板 (polished UI) — 侧栏
 * - 卡片化列表, 类型彩色图标
 * - 复制 / 撤销 状态反馈
 */
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X, Copy, Check, Trash2, Link2, Lock, Calendar, Eye,
  Download, ChevronRight, Share2, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileTypeBadge } from './file-type-badge';

interface ShareRow {
  id: string;
  token: string;
  url: string;
  fileId: string;
  fileName: string;
  isDir: boolean;
  size: string;
  mimeType?: string | null;
  allowDownload: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

async function fetchShares(): Promise<ShareRow[]> {
  const r = await fetch('/api/pan/shares', { cache: 'no-store' });
  if (!r.ok) throw new Error('failed to load shares');
  const j = await r.json();
  return j.data ?? [];
}

function formatSize(bytes: string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return '从未';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date();
}

export function SharesPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-shares'],
    queryFn: fetchShares,
    refetchInterval: 10_000,
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/pan/share/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? '撤销失败');
    },
    onSuccess: () => {
      toast.success('已撤销');
      qc.invalidateQueries({ queryKey: ['my-shares'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(s: ShareRow) {
    const fullUrl = `${window.location.origin}${s.url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(s.id);
      toast.success('链接已复制');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('复制失败');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="gpu flex h-full w-full max-w-md flex-col border-l border-border/40 bg-surface shadow-2xl animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <header className="flex items-center justify-between border-b border-border/30 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-accent">
              <Share2 className="h-4 w-4" />
            </div>
            我的分享
            {data && data.length > 0 && (
              <span className="ml-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-xs font-normal text-accent">
                {data.length}
              </span>
            )}
          </h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-text-muted">加载中…</div>
          ) : !data || data.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {data.map((s) => (
                <ShareCard
                  key={s.id}
                  share={s}
                  copied={copiedId === s.id}
                  onCopy={() => handleCopy(s)}
                  onRevoke={() => {
                    if (confirm(`撤销分享 "${s.fileName}"?`)) revoke.mutate(s.id);
                  }}
                  revoking={revoke.isPending}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function ShareCard({
  share, copied, onCopy, onRevoke, revoking,
}: {
  share: ShareRow;
  copied: boolean;
  onCopy: () => void;
  onRevoke: () => void;
  revoking: boolean;
}) {
  const expired = isExpired(share.expiresAt);
  return (
    <li
      className={`group rounded-xl border bg-surface p-3 transition-all hover:shadow-sm ${
        expired ? 'border-border/30 opacity-60' : 'border-border/40 hover:border-accent/40'
      }`}
    >
      {/* header: icon + name + revoke */}
      <div className="flex items-start gap-3">
        <FileTypeBadge name={share.fileName} mime={share.mimeType ?? null} isDir={share.isDir} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={share.fileName}>
            {share.fileName}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
            <span>{share.isDir ? '文件夹' : formatSize(share.size)}</span>
            <span className="text-text-faint">·</span>
            <span>创建 {formatRelative(share.createdAt)}</span>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
          onClick={onRevoke}
          disabled={revoking}
          title="撤销"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* status pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {expired ? (
          <Pill accent="danger">已过期</Pill>
        ) : share.expiresAt ? (
          <Pill icon={<Calendar className="h-3 w-3" />}>
            {new Date(share.expiresAt).toLocaleDateString('zh-CN')}
          </Pill>
        ) : (
          <Pill>永不过期</Pill>
        )}
        {share.hasPassword && <Pill icon={<Lock className="h-3 w-3" />} accent>密码</Pill>}
        {share.allowDownload ? (
          <Pill icon={<Download className="h-3 w-3" />}>可下载</Pill>
        ) : (
          <Pill accent="muted">仅查看</Pill>
        )}
        <Pill icon={<Eye className="h-3 w-3" />} accent="muted">
          {share.accessCount} 次
        </Pill>
        {share.lastAccessedAt && (
          <span className="ml-auto text-[10px] text-text-faint">
            最近 {formatRelative(share.lastAccessedAt)}
          </span>
        )}
      </div>

      {/* action: copy link */}
      <div className="mt-3 flex items-center gap-1">
        <button
          onClick={onCopy}
          className="flex flex-1 items-center gap-2 truncate rounded-md border border-border/30 bg-bg/40 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-accent/40 hover:bg-accent/5"
        >
          {copied ? (
            <Check className="h-3 w-3 shrink-0 text-accent" />
          ) : (
            <Link2 className="h-3 w-3 shrink-0 text-text-muted" />
          )}
          <span className="min-w-0 flex-1 truncate font-mono text-text-muted">
            {typeof window !== 'undefined' ? `${window.location.origin}${share.url}` : share.url}
          </span>
          <span className="shrink-0 text-[10px] font-medium text-accent">
            {copied ? '已复制' : '复制'}
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-text-faint" />
        </button>
      </div>
    </li>
  );
}

function Pill({
  children, icon, accent,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'danger' | 'muted' | true;
}) {
  const cls = accent === 'danger'
    ? 'border-danger/30 bg-danger/10 text-danger'
    : accent === 'muted'
      ? 'border-border/30 bg-bg/40 text-text-muted'
      : accent === true
        ? 'border-accent/30 bg-accent/10 text-accent'
        : 'border-border/30 bg-bg/40 text-text-muted';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
      {icon}
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Inbox className="h-7 w-7" />
      </div>
      <h3 className="mt-4 text-sm font-medium">还没有分享</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
        在文件列表上点击
        <Share2 className="mx-1 inline h-3 w-3 align-text-bottom" />
        按钮即可创建分享链接
      </p>
    </div>
  );
}
