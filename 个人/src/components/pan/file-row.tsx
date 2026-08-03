/**
 * 单个文件/文件夹行 (polished UI)
 */
'use client';

import { useState } from 'react';
import { Download, Trash2, Pencil, Check, X, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FileTypeBadge } from './file-type-badge';

interface FileItem {
  id: string;
  name: string;
  size: string;
  mimeType: string | null;
  isDir: boolean;
  isShared: boolean;
  updatedAt: string;
}

function formatSize(bytes: string): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n === 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function FileRow({
  file,
  onOpen,
  onDelete,
  onRename,
  onShare,
}: {
  file: FileItem;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
  onShare?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);

  return (
    <li className="group flex items-center gap-3 px-4 py-2 transition-colors hover:bg-bg/40">
      {/* type icon */}
      {editing ? (
        <div className="h-7 w-7 shrink-0" />
      ) : (
        <FileTypeBadge
          name={file.name}
          mime={file.mimeType}
          isDir={file.isDir}
          size="sm"
        />
      )}

      {/* name */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-7 max-w-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (draft.trim() && draft !== file.name) onRename(draft.trim());
                setEditing(false);
              } else if (e.key === 'Escape') {
                setDraft(file.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            onClick={onOpen}
            className={`min-w-0 flex-1 truncate text-left text-sm transition-colors ${
              file.isDir
                ? 'font-medium hover:text-accent'
                : 'text-text hover:text-accent'
            }`}
            title={file.name}
          >
            {file.name}
          </button>
        )}
        {file.isShared && !editing && (
          <span className="hidden shrink-0 rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0 text-[10px] font-medium text-accent sm:inline-block">
            共享池
          </span>
        )}
      </div>

      {/* meta */}
      <div className="hidden w-24 text-right text-xs tabular-nums text-text-muted md:block">
        {file.isDir ? '—' : formatSize(file.size)}
      </div>
      <div className="hidden w-32 text-right text-xs text-text-muted lg:block">
        {formatDate(file.updatedAt)}
      </div>

      {/* actions */}
      <div className="flex items-center gap-0.5">
        {editing ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                if (draft.trim() && draft !== file.name) onRename(draft.trim());
                setEditing(false);
              }}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => {
                setDraft(file.name);
                setEditing(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            {!file.isDir && (
              <a
                href={`/api/pan/download/${file.id}`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-muted opacity-0 transition-opacity hover:bg-accent/10 hover:text-accent group-hover:opacity-100"
                title="下载"
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            {onShare && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                onClick={onShare}
                title="分享"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => {
                setDraft(file.name);
                setEditing(false);
                setEditing(true);
              }}
              title="重命名"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
              onClick={onDelete}
              title="删除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
