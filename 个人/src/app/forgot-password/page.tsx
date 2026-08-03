'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '请求过于频繁, 请稍后再试');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '请求失败, 请稍后再试');
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="container flex min-h-[calc(100vh-120px)] items-center justify-center py-10">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold tracking-tight">邮件已发送</h1>
          <p className="mt-3 text-sm text-text-muted">
            如果该邮箱已注册, 重置链接已发送到你的邮箱.
            <br />
            链接 1 小时内有效.
          </p>
          <p className="mt-6 text-sm">
            <Link href="/signin" className="text-accent hover:underline">返回登录</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex min-h-[calc(100vh-120px)] items-center justify-center py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">找回密码</h1>
          <p className="mt-2 text-sm text-text-muted">
            输入你的注册邮箱, 我们会发送重置链接.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">邮箱</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={isPending}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? '发送中...' : '发送重置链接'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-muted">
          <Link href="/signin" className="text-accent hover:underline">返回登录</Link>
        </div>
      </div>
    </div>
  );
}
