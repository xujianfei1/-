'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function PeriodError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[period page error]', error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-6xl font-bold text-destructive">!</p>
      <h1 className="mt-4 text-xl font-semibold">预测功能暂时不可用</h1>
      <p className="mt-2 max-w-md text-sm text-text-muted">
        {error.message || '页面渲染时发生错误,请稍后重试。'}
      </p>
      {error.digest && <p className="mt-1 text-xs text-text-faint">错误码: {error.digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Button variant="outline" onClick={() => (window.location.href = '/')}>
          回到首页
        </Button>
      </div>
    </div>
  );
}
