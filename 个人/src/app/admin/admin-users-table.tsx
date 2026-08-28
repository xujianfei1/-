/**
 * Admin 用户列表 (客户端组件)
 * - 表格展示所有用户
 * - 行内操作: 封禁/解封, 注销账号
 * - 点用户 → /admin/users/[id]
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Trash2, ChevronRight, Shield, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserRow {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  banned: boolean;
  fileCount: number;
  totalSize: string;
  quotaBytes: string;
  createdAt: string;
}

function formatBytes(n: bigint | string | number): string {
  const num = typeof n === 'bigint' ? Number(n) : Number(n);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

async function patchBan(userId: string, banned: boolean): Promise<void> {
  const r = await fetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ banned }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '封禁状态切换失败');
}

async function deleteUser(userId: string): Promise<void> {
  const r = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || '注销失败');
}

export function AdminUsersTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState<{ userId: string; name: string } | null>(null);

  const banMut = useMutation({
    mutationFn: ({ userId, banned }: { userId: string; banned: boolean }) =>
      patchBan(userId, banned),
    onSuccess: (_d, vars) => {
      toast.success(vars.banned ? '已封禁' : '已解封');
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteUser(userId),
    onSuccess: () => {
      toast.success('账号已注销');
      setConfirmDelete(null);
      router.refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="rounded-xl border border-border/40 bg-surface">
      <div className="border-b border-border/40 px-4 py-3">
        <h2 className="text-sm font-semibold">用户列表</h2>
        <p className="mt-0.5 text-xs text-text-muted">
          点击用户查看其文件. 私人文件按 ownerId 算用量, 共享池不计入.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-2 font-medium">用户</th>
              <th className="px-3 py-2 font-medium">角色</th>
              <th className="px-3 py-2 font-medium text-right">文件</th>
              <th className="px-3 py-2 font-medium text-right">用量 / 配额</th>
              <th className="px-3 py-2 font-medium">注册</th>
              <th className="px-4 py-2 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const usage = Number(u.totalSize);
              const quota = Number(u.quotaBytes);
              const pct = quota > 0 ? Math.round((usage / quota) * 100) : 0;
              return (
                <tr
                  key={u.id}
                  className="border-b border-border/20 last:border-0 hover:bg-bg/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="flex items-center gap-2 hover:text-accent"
                    >
                      <span className="font-medium">{u.name || u.email}</span>
                      {u.name && (
                        <span className="text-xs text-text-muted">{u.email}</span>
                      )}
                      {u.banned && (
                        <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                          已封禁
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    {u.isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                        <ShieldCheck className="h-3 w-3" />
                        admin
                      </span>
                    ) : (
                      <span className="text-xs text-text-muted">用户</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{u.fileCount}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    <div>{formatBytes(usage)}</div>
                    <div className="text-[10px] text-text-muted">
                      {pct}% / {formatBytes(quota)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button size="sm" variant="ghost" title="查看文件">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={banMut.isPending}
                        onClick={() => banMut.mutate({ userId: u.id, banned: !u.banned })}
                        title={u.banned ? '解封' : '封禁'}
                      >
                        {u.banned ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Ban className="h-3.5 w-3.5 text-warning" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={u.isAdmin || deleteMut.isPending}
                        onClick={() => setConfirmDelete({ userId: u.id, name: u.name || u.email })}
                        title={u.isAdmin ? '不能注销 admin' : '注销账号'}
                      >
                        <Trash2 className={`h-3.5 w-3.5 ${u.isAdmin ? 'text-text-faint' : 'text-danger'}`} />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 注销确认模态框 */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !deleteMut.isPending && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">注销账号</h3>
            <p className="mt-2 text-sm text-text-muted">
              确认注销 <span className="font-medium text-text">{confirmDelete.name}</span> ?
              <br />
              该用户的全部文件会物理删除, 不可恢复.
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
                onClick={() => deleteMut.mutate(confirmDelete.userId)}
              >
                {deleteMut.isPending ? '处理中…' : '确认注销'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}