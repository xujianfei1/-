/**
 * 单用户的文件列表 (admin 客户端组件)
 * - 行内: 下载 / 递归删除
 * - 顶层: 按 isShared / isDir 切换 filter
 */
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Trash2, Folder, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileRow {
  id: string;
  name: string;
  mimeType: string | null;
  size: string;
  isDir: boolean;
  isShared: boolean;
  createdAt: string;
}

function formatBytes(n: bigint | string | number): string {
  const num = typeof n === 'bigint' ? Number(n) : Number(n);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function deleteFileAdmin(id: string): Promise<void> {
  const r = await fetch(`/api/admin/files/${id}`, { method: 'DELETE' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '删除失败');
}

export function AdminUserFilesTable({ files }: { files: FileRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'private' | 'shared'>('all');
  const [confirmDelete, setConfirmDelete] = useState<FileRow | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'private') return files.filter((f) => !f.isShared);
    if (filter === 'shared') return files.filter((f) => f.isShared);
    return files;
  }, [files, filter]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFileAdmin(id),
    onSuccess: () => {
      toast.success('已删除');
      setConfirmDelete(null);
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const counts = useMemo(
    () => ({
      all: files.length,
      private: files.filter((f) => !f.isShared).length,
      shared: files.filter((f) => f.isShared).length,
    }),
    [files],
  );

  return (
    <div className="rounded-xl border border-border/40 bg-surface">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">文件 ({files.length})</h2>
          <p className="mt-0.5 text-xs text-text-muted">
            admin 操作会物理删除文件, 谨慎.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border/40 p-0.5">
          {(['all', 'private', 'shared'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                filter === k
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {k === 'all' ? '全部' : k === 'private' ? '私人' : '共享池'}
              <span className="ml-1 text-[10px] tabular-nums opacity-70">
                {counts[k]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-text-muted">
          {files.length === 0 ? '该用户没有任何文件' : '当前 filter 无文件'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2 font-medium">文件名</th>
                <th className="px-3 py-2 font-medium">类型</th>
                <th className="px-3 py-2 font-medium text-right">大小</th>
                <th className="px-3 py-2 font-medium">创建</th>
                <th className="px-4 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-border/20 last:border-0 hover:bg-bg/40">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {f.isDir ? (
                        <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                      )}
                      <span className="truncate font-medium" title={f.name}>{f.name}</span>
                      {f.isShared && (
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent">
                          共享池
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">
                    {f.isDir ? '目录' : f.mimeType ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {f.isDir ? '—' : formatBytes(f.size)}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-text-muted">
                    {new Date(f.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!f.isDir && (
                        <a
                          href={`/api/admin/files/${f.id}/download`}
                          download={f.name}
                          title="下载"
                        >
                          <Button size="sm" variant="ghost">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={deleteMut.isPending}
                        onClick={() => setConfirmDelete(f)}
                        title="递归删除"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleteMut.isPending && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">递归删除</h3>
            <p className="mt-2 text-sm text-text-muted">
              确认删除{' '}
              <span className="font-medium text-text">
                {confirmDelete.name}
                {confirmDelete.isDir && ' (含子目录)'}
              </span>
              ? 物理文件一并删除, 不可恢复.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={deleteMut.isPending}
                onClick={() => setConfirmDelete(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteMut.isPending}
                onClick={() => deleteMut.mutate(confirmDelete.id)}
              >
                {deleteMut.isPending ? '处理中…' : '确认删除'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}