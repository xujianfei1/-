'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-7xl font-bold text-destructive">!</p>
      <h1 className="mt-4 text-2xl font-semibold">出错了</h1>
      <p className="mt-2 text-text-muted max-w-md">{error.message || '页面渲染时发生错误'}</p>
      {error.digest && <p className="mt-1 text-xs text-text-faint">错误码: {error.digest}</p>}
      <Button onClick={reset} className="mt-6">
        重试
      </Button>
    </div>
  );
}
