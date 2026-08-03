/**
 * 文件预览模态
 * - 图片: 居中显示, 原比例, 过大加滚动
 * - PDF: 浏览器内置 PDF viewer (iframe)
 * - ESC / 点背景 / 点 X 关闭
 * - 提供下载/分享入口 (沿用 file-row 的能力)
 */
'use client';

import { useEffect } from 'react';
import { X, Download, Share2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileTypeBadge, getFileTypeStyle } from './file-type-badge';
import { getPreviewKind } from '@/lib/preview';

interface PreviewableFile {
  id: string;
  name: string;
  mimeType: string | null;
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

export function FilePreviewModal({
  file,
  previewUrl,
  downloadUrl,
  onClose,
  onShare,
}: {
  file: PreviewableFile;
  /** 预览用的 URL (Content-Disposition: inline) */
  previewUrl: string;
  /** 下载用的 URL (Content-Disposition: attachment) */
  downloadUrl: string;
  onClose: () => void;
  /** 文件预览场景下不可分享 (如公开页), 隐藏按钮 */
  onShare?: () => void;
}) {
  const kind = getPreviewKind(file.mimeType, file.name);
  const style = getFileTypeStyle(file.name, file.mimeType, file.isDir);

  // ESC 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // 锁定 body 滚动
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      {/* top bar */}
      <div
        className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <FileTypeBadge name={file.name} mime={file.mimeType} isDir={false} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-white/60">
            <span>{formatSize(file.size)}</span>
            {file.mimeType && <span>· {file.mimeType}</span>}
            <span>· {style.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onShare && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onShare}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Share2 className="mr-1 h-4 w-4" />
              分享
            </Button>
          )}
          <a
            href={downloadUrl}
            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Download className="h-4 w-4" />
            下载
          </a>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-8 w-8 text-white/80 hover:bg-white/10 hover:text-white"
            title="关闭 (ESC)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* body */}
      <div
        className="flex-1 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {kind === 'image' ? (
          <ImagePreview url={previewUrl} name={file.name} />
        ) : kind === 'pdf' ? (
          <PdfPreview url={previewUrl} />
        ) : (
          <UnsupportedPreview name={file.name} />
        )}
      </div>

      {/* bottom hint */}
      <div
        className="shrink-0 border-t border-white/10 bg-black/40 px-4 py-2 text-center text-[11px] text-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        按 <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">ESC</kbd> 关闭
        · 滚轮缩放图片 (浏览器原生)
      </div>
    </div>
  );
}

function ImagePreview({ url, name }: { url: string; name: string }) {
  return (
    <div className="flex min-h-full items-center justify-center p-6">
      <img
        src={url}
        alt={name}
        className="max-h-[calc(100vh-160px)] max-w-full rounded shadow-2xl"
        loading="eager"
        decoding="async"
        onError={(e) => {
          // 图片加载失败 → 替换为占位
          (e.currentTarget as HTMLImageElement).style.display = 'none';
          (e.currentTarget.parentElement as HTMLElement).innerHTML =
            '<div class="text-white/70 text-sm">图片加载失败</div>';
        }}
      />
    </div>
  );
}

function PdfPreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="PDF preview"
      className="h-[calc(100vh-120px)] w-full bg-white"
    />
  );
}

function UnsupportedPreview({ name }: { name: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-white/70">
      <FileText className="h-12 w-12" />
      <p className="mt-3 text-sm">暂不支持此类型预览</p>
      <p className="mt-1 text-xs text-white/40">{name}</p>
    </div>
  );
}

/* ============================================================ */
/*  Inline preview (公开分享页用) — 不弹模态, 直接渲染到页面上   */
/* ============================================================ */
export function InlinePreview({
  file,
  previewUrl,
  downloadUrl,
  downloadOnClick,
}: {
  file: PreviewableFile;
  previewUrl: string;
  downloadUrl: string;
  /** 公开页: 用 downloadToken 拼 URL 后跳转 */
  downloadOnClick?: () => void;
}) {
  const kind = getPreviewKind(file.mimeType, file.name);
  if (kind === 'image') {
    return (
      <div className="overflow-hidden rounded-xl border border-border/30 bg-surface shadow-sm">
        <img
          src={previewUrl}
          alt={file.name}
          className="block max-h-[70vh] w-full object-contain"
          loading="lazy"
          decoding="async"
        />
        <div className="flex items-center justify-between gap-2 border-t border-border/30 bg-bg/30 px-4 py-2 text-xs text-text-muted">
          <span className="truncate">{file.name}</span>
          {downloadOnClick ? (
            <button
              onClick={downloadOnClick}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              <Download className="h-3 w-3" /> 下载原图
            </button>
          ) : (
            <a href={downloadUrl} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Download className="h-3 w-3" /> 下载原图
            </a>
          )}
        </div>
      </div>
    );
  }
  if (kind === 'pdf') {
    return (
      <div className="overflow-hidden rounded-xl border border-border/30 bg-surface shadow-sm">
        <iframe src={previewUrl} title={file.name} className="h-[70vh] w-full bg-white" />
        <div className="flex items-center justify-between gap-2 border-t border-border/30 bg-bg/30 px-4 py-2 text-xs text-text-muted">
          <span className="truncate">{file.name}</span>
          {downloadOnClick ? (
            <button onClick={downloadOnClick} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Download className="h-3 w-3" /> 下载 PDF
            </button>
          ) : (
            <a href={downloadUrl} className="inline-flex items-center gap-1 text-accent hover:underline">
              <Download className="h-3 w-3" /> 下载 PDF
            </a>
          )}
        </div>
      </div>
    );
  }
  return null;
}
