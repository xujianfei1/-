/**
 * 云盘客户端根 (polished UI)
 * - 状态: currentFolderId (string | null = 根), scope ('private' | 'shared')
 * - 工具: 新建文件夹, 上传, 切换 scope, 进入子目录
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Folder, Users, Sparkles, Cloud } from 'lucide-react';
import { FileBrowser } from './file-browser';
import { QuotaBar } from './quota-bar';

interface Props {
  userId: string;
  userName: string;
  portalUrl: string | null;
  initialScope?: 'private' | 'shared';
}

export function PanClient({ userName, portalUrl, initialScope = 'private' }: Props) {
  const [scope, setScope] = useState<'private' | 'shared'>(initialScope);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  return (
    <div className="container py-6 md:py-10">
      {/* 返回链接 */}
      {portalUrl && (
        <Link
          href={portalUrl}
          className="mb-3 inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3 w-3" />
          返回个人门户
        </Link>
      )}

      {/* Hero */}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-amber-400 text-white shadow-sm shadow-accent/30">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">云盘</h1>
            <p className="mt-0.5 text-sm text-text-muted">
              {userName ? `${userName} 的文件 · 私人空间 + 全员共享池` : '私人文件 + 全员共享池'}
            </p>
          </div>
        </div>

        {/* 范围切换 (segmented control) */}
        <div className="inline-flex rounded-lg border border-border/40 bg-surface p-1 shadow-sm">
          <ScopeButton
            active={scope === 'private'}
            onClick={() => { setScope('private'); setCurrentFolderId(null); }}
            icon={<Folder className="h-3.5 w-3.5" />}
            label="我的文件"
          />
          <ScopeButton
            active={scope === 'shared'}
            onClick={() => { setScope('shared'); setCurrentFolderId(null); }}
            icon={<Users className="h-3.5 w-3.5" />}
            label="共享池"
          />
        </div>
      </header>

      {scope === 'private' && <QuotaBar />}

      <FileBrowser
        scope={scope}
        folderId={currentFolderId}
        onEnter={setCurrentFolderId}
      />

      {/* 底部信息 */}
      <footer className="mt-10 flex items-center justify-center gap-1.5 text-[11px] text-text-faint">
        <Sparkles className="h-3 w-3" />
        <span>文件物理存储于 ECS · 1 GB 私人配额</span>
      </footer>
    </div>
  );
}

function ScopeButton({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
        active
          ? 'bg-accent text-white shadow-sm'
          : 'text-text-muted hover:bg-bg/40 hover:text-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
