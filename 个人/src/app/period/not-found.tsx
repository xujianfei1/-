import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-7xl font-bold text-accent">404</p>
      <h1 className="mt-4 text-2xl font-semibold">没有这个经期页面</h1>
      <p className="mt-2 text-text-muted">可能链接已失效</p>
      <Button asChild className="mt-6">
        <Link href="/period">回到经期预测</Link>
      </Button>
    </div>
  );
}
