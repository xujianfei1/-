'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HeroBackdrop } from '@/components/hero-backdrop';

type Mode = 'login' | 'register';

export default function SignInPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initialMode: Mode = search.get('mode') === 'register' ? 'register' : 'login';
  const callbackUrl = search.get('callbackUrl') ?? '/';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    const url = new URL(window.location.href);
    if (next === 'register') url.searchParams.set('mode', 'register');
    else url.searchParams.delete('mode');
    window.history.replaceState(null, '', url.toString());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'register') {
      if (!name.trim()) {
        setError('请输入昵称');
        return;
      }
      if (password.length < 6) {
        setError('密码至少 6 位');
        return;
      }
      startTransition(async () => {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? '注册失败');
          return;
        }
        await doSignIn();
      });
      return;
    }

    await doSignIn();
  }

  async function doSignIn() {
    startTransition(async () => {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError('邮箱或密码错误');
        return;
      }
      router.replace(callbackUrl);
      router.refresh();
    });
  }

  return (
    <div className="relative">
    <HeroBackdrop className="absolute inset-0" scrim="bg-black/50" fadeToBg={false} />
    <div className="container relative flex min-h-screen items-center justify-center py-10">
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center [&_h1]:text-white [&_h1]:drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] [&_.text-text-muted]:text-white/85">
          <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-amber-400 text-lg font-bold text-white shadow-lg shadow-accent/25">
            ✦
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === 'login' ? '登录个人门户' : '创建账号'}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {mode === 'login' ? '登录后即可使用经期预测等功能' : '注册后即可使用完整功能'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-surface/90 p-6 shadow-2xl backdrop-blur-xl">
        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-1.5">
              <label htmlFor="name" className="text-sm font-medium">
                昵称
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="你的昵称"
                required
                autoComplete="nickname"
                disabled={isPending}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              邮箱
            </label>
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              {mode === 'login' && (
                <a
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-accent hover:underline"
                >
                  忘记密码?
                </a>
              )}
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 位' : ''}
              required
              minLength={6}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              disabled={isPending}
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending
              ? mode === 'login' ? '登录中...' : '注册中...'
              : mode === 'login' ? '登录' : '注册并登录'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-text-muted">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="ml-1 text-accent hover:underline"
              >
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="ml-1 text-accent hover:underline"
              >
                直接登录
              </button>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
    </div>
  );
}
