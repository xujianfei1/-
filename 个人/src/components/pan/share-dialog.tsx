/**
 * 分享创建对话框 (polished UI)
 *
 * - 顶部展示被分享的文件/文件夹预览
 * - 选项分组: 访问控制 / 高级
 * - 创建后弹"链接已就绪"大框, 一键复制
 */
'use client';

import { useState } from 'react';
import { X, Copy, Check, Link2, Lock, Calendar, Download, Eye, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { FileTypeBadge } from './file-type-badge';

interface CreatedShare {
  id: string;
  token: string;
  url: string;
  expiresAt: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
}

export function ShareDialog({
  fileId,
  fileName,
  fileMime,
  fileIsDir,
  onClose,
}: {
  fileId: string;
  fileName: string;
  fileMime: string | null;
  fileIsDir: boolean;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [allowDownload, setAllowDownload] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate() {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { fileId, allowDownload };
      if (password) body.password = password;
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();

      const r = await fetch('/api/pan/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(j.error ?? '创建失败');
        return;
      }
      setCreated(j.data);
      const fullUrl = `${window.location.origin}${j.data.url}`;
      try {
        await navigator.clipboard.writeText(fullUrl);
        toast.success('链接已复制到剪贴板');
      } catch {
        // 权限或不支持时忽略
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '网络错误');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    const fullUrl = `${window.location.origin}${created.url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success('已复制');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败, 请手动复制');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="gpu w-full max-w-md overflow-hidden rounded-2xl border border-border/40 bg-surface shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {created ? (
          <CreatedView
            share={created}
            copied={copied}
            onCopy={handleCopy}
            onClose={onClose}
          />
        ) : (
          <>
            {/* header */}
            <div className="flex items-center justify-between border-b border-border/30 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Link2 className="h-4 w-4 text-accent" />
                分享
              </h2>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* 被分享的文件预览 */}
            <div className="flex items-center gap-3 border-b border-border/30 bg-bg/30 px-5 py-4">
              <FileTypeBadge name={fileName} mime={fileMime} isDir={fileIsDir} size="md" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium" title={fileName}>
                  {fileName}
                </div>
                <div className="text-xs text-text-muted">
                  {fileIsDir ? '文件夹 · 下载时打包为 zip' : '文件'}
                </div>
              </div>
            </div>

            {/* 选项 */}
            <div className="space-y-5 px-5 py-5">
              {/* 访问控制 */}
              <Section title="访问控制">
                <Field icon={<Lock className="h-3.5 w-3.5" />} label="访问密码 (可选)">
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="留空则任何人可访问"
                  />
                </Field>
                <Field icon={<Calendar className="h-3.5 w-3.5" />} label="过期时间 (可选)">
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </Field>
              </Section>

              {/* 高级 */}
              <Section title="下载设置">
                <ToggleField
                  icon={<Download className="h-3.5 w-3.5" />}
                  label="允许下载"
                  desc="关闭后仅展示文件信息, 不提供下载链接"
                  checked={allowDownload}
                  onChange={setAllowDownload}
                />
              </Section>
            </div>

            {/* 底部操作 */}
            <div className="flex gap-2 border-t border-border/30 bg-bg/30 px-5 py-4">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button onClick={handleCreate} disabled={submitting} className="flex-1">
                {submitting ? '创建中…' : '创建分享链接'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- 子组件 ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  icon, label, children,
}: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-muted">
        {icon}
        {label}
      </label>
      {children}
    </div>
  );
}

function ToggleField({
  icon, label, desc, checked, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/30 p-3 transition-colors hover:bg-bg/40 has-[input:checked]:border-accent/40 has-[input:checked]:bg-accent/5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon}
          {label}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{desc}</div>
      </div>
    </label>
  );
}

function CreatedView({
  share, copied, onCopy, onClose,
}: {
  share: CreatedShare;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const fullUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${share.url}`;

  return (
    <div>
      {/* 顶部: 成功提示 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-accent/15 via-accent/5 to-transparent px-6 py-7 text-center">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30">
            <Check className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">分享已就绪</h3>
          <p className="mt-1 text-xs text-text-muted">
            1 小时内任何人凭此链接可访问 ·{' '}
            <a href="/pan" className="text-accent hover:underline">查看我的分享</a>
          </p>
        </div>
      </div>

      {/* 配置摘要 */}
      <div className="grid grid-cols-3 gap-2 border-y border-border/30 bg-bg/30 px-5 py-3 text-xs">
        {share.hasPassword ? (
          <SummaryItem icon={<Lock className="h-3 w-3" />} label="密码" />
        ) : (
          <SummaryItem icon={<Eye className="h-3 w-3" />} label="公开" />
        )}
        <SummaryItem
          icon={<Calendar className="h-3 w-3" />}
          label={share.expiresAt ? new Date(share.expiresAt).toLocaleDateString('zh-CN') : '永不过期'}
        />
        <SummaryItem
          icon={<Download className="h-3 w-3" />}
          label={share.allowDownload ? '可下载' : '仅查看'}
        />
      </div>

      {/* 链接框 */}
      <div className="space-y-3 px-5 py-5">
        <div className="flex gap-2">
          <Input
            readOnly
            value={fullUrl}
            className="flex-1 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button onClick={onCopy} variant={copied ? 'default' : 'outline'} className="min-w-[80px]">
            {copied ? <><Check className="mr-1 h-4 w-4" />已复制</> : <><Copy className="mr-1 h-4 w-4" />复制</>}
          </Button>
        </div>
        <Button onClick={onClose} className="w-full">
          完成
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 text-text-muted">
      {icon}
      <span>{label}</span>
    </div>
  );
}
