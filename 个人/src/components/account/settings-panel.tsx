/**
 * 账号设置面板
 * - 改昵称 (邮箱不可改)
 * - 登出
 * - 注销账号 (弹确认框, 需要敲 "DELETE" 才执行)
 *
 * 打开: 点 topbar 头像 → dropdown → "账号设置"
 * 关闭: 点 backdrop / 右上 X / Esc
 */
'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { X, LogOut, UserMinus, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update: updateSession } = useSession();
  const [name, setName] = useState('');
  const [initialName, setInitialName] = useState('');
  const [email, setEmail] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // 打开时从 /api/account/me 拉最新 user info (session 在 cache 时可能不准)
  useEffect(() => {
    if (!open) return;
    setName('');
    setInitialName('');
    setEmail('');
    setConfirmingDelete(false);
    setDeleteText('');
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/account/me', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (cancelled || !j.data) return;
        setName(j.data.name ?? '');
        setInitialName(j.data.name ?? '');
        setEmail(j.data.email ?? '');
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Esc 关
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const nameDirty = name.trim() !== initialName;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('昵称不能为空');
      return;
    }
    if (trimmed === initialName) return;
    setSavingName(true);
    try {
      const r = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '保存失败');
      setInitialName(trimmed);
      // 触发 next-auth session 重新拉, 让 topbar 头像等用新 name
      await updateSession?.();
      toast.success('昵称已更新');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      // signOut 内部会调 /api/auth/signout 并清 cookie
      await signOut({ callbackUrl: '/signin' });
    } catch (e) {
      toast.error((e as Error).message);
      setSigningOut(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      const r = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '注销失败');
      toast.success(`账号已注销 (清理 ${j.data?.filesDeleted ?? 0} 个文件)`, { duration: 5000 });
      // 跳到首页, 清掉所有缓存
      await signOut({ callbackUrl: '/' });
    } catch (e) {
      toast.error((e as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="settings-title" className="text-sm font-semibold">
            账号设置
          </h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="关闭">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 主体 */}
        <div className="space-y-5 p-5">
          {/* 邮箱 (只读) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-muted">邮箱 (登录身份, 不可改)</label>
            <div className="rounded-md border border-border/60 bg-bg/50 px-3 py-2 text-sm text-text-muted">
              {email || '加载中…'}
            </div>
          </div>

          {/* 改昵称 */}
          <div className="space-y-1.5">
            <label htmlFor="settings-name" className="text-xs font-medium text-text-muted">
              昵称
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="昵称"
                maxLength={50}
                disabled={savingName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nameDirty) saveName();
                }}
              />
              <Button
                size="sm"
                onClick={saveName}
                disabled={!nameDirty || savingName}
              >
                {savingName ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1 h-3.5 w-3.5" />
                )}
                保存
              </Button>
            </div>
            <p className="text-[11px] text-text-faint">用于显示在顶栏等位置</p>
          </div>

          {/* 登出 */}
          <div className="rounded-lg border border-border/40 bg-bg/30 p-3">
            <div className="mb-2 flex items-start gap-2">
              <LogOut className="mt-0.5 h-4 w-4 text-text-muted" />
              <div className="flex-1">
                <div className="text-sm font-medium">退出登录</div>
                <p className="text-xs text-text-muted">退出后需重新输入邮箱和密码登录</p>
              </div>
              <Button size="sm" variant="outline" onClick={handleSignOut} disabled={signingOut}>
                {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '登出'}
              </Button>
            </div>
          </div>

          {/* 注销账号 (危险) */}
          <div className="rounded-lg border border-danger/30 bg-danger/5 p-3">
            <div className="mb-2 flex items-start gap-2">
              <UserMinus className="mt-0.5 h-4 w-4 text-danger" />
              <div className="flex-1">
                <div className="text-sm font-medium text-danger">注销账号</div>
                <p className="text-xs text-text-muted">
                  永久删除账号和所有数据 (文件 / 分享 / 上传会话), 不可恢复
                </p>
              </div>
              {!confirmingDelete && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-danger/40 text-danger hover:bg-danger/10"
                  onClick={() => setConfirmingDelete(true)}
                >
                  注销…
                </Button>
              )}
            </div>

            {confirmingDelete && (
              <div className="mt-3 space-y-2 border-t border-danger/20 pt-3">
                <div className="flex items-start gap-1.5 rounded-md bg-bg/60 p-2 text-[11px] text-text-muted">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-danger" />
                  <span>
                    敲 <span className="font-mono text-danger">DELETE</span> 确认. 此操作不可撤销.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={deleteText}
                    onChange={(e) => setDeleteText(e.target.value)}
                    placeholder='输入 DELETE'
                    className="font-mono"
                    disabled={deleting}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && deleteText === 'DELETE') handleDeleteAccount();
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setConfirmingDelete(false);
                      setDeleteText('');
                    }}
                    disabled={deleting}
                  >
                    取消
                  </Button>
                  <Button
                    size="sm"
                    className="bg-danger text-white hover:bg-danger/90"
                    onClick={handleDeleteAccount}
                    disabled={deleteText !== 'DELETE' || deleting}
                  >
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '确认注销'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
