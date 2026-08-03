import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-screen flex-col items-center justify-center text-center">
      <p className="text-7xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-semibold">页面未找到</h1>
      <p className="mt-2 text-text-muted">你访问的页面不存在或已被移除</p>
      <Button asChild className="mt-6">
        <Link href="/">返回首页</Link>
      </Button>
    </div>
  );
}
