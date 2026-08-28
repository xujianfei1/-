/**
 * /blog/write - 博客编辑器 (仅 admin)
 * 未登录 → /signin; 非管理员 → 404
 */
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { BlogEditor } from '@/components/blog/editor';

export const metadata: Metadata = {
  title: '写文章',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function BlogWritePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }
  if (!session.user.isAdmin) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <main className="container flex-1 py-6 md:py-10">
        <BlogEditor />
      </main>
      <Footer />
    </div>
  );
}
