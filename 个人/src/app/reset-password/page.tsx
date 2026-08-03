'use client';

import { useState, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function ResetPasswordForm() {
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        链接无效: 缺少 token 参数.
      </div>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '重置失败, 请稍后再试');
        return;
      }
      setDone(true);
      setTimeout(() => router.replace('/signin'), 1500);
    });
  }

  if (done) {
    return (
      <div className="text-center">
        <h2 className="text-xl font-semibold">密码已重置</h2>
        <p className="mt-2 text-sm text-text-muted">正在跳转到登录...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">新密码</label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="至少 6 位"
          required
          minLength={6}
          autoComplete="new-password"
          disabled={isPending}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">确认新密码</label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="再输入一次"
          required
          minLength={6}
          autoComplete="new-password"
          disabled={isPending}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? '重置中...' : '重置密码'}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex min-h-[calc(100vh-120px)] items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">设置新密码</h1>
        </div>
        <Suspense fallback={<div className="text-sm text-text-muted">加载中...</div>}>
          <ResetPasswordForm />
        </Suspense>
        <div className="mt-6 text-center text-sm text-text-muted">
          <Link href="/signin" className="text-accent hover:underline">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
