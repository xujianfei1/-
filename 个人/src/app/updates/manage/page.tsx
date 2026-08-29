/**
 * /updates/manage - 更新公告管理 (仅 admin)
 */
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { UpdatesManager } from '@/components/updates/manager';

export const metadata: Metadata = {
  title: '管理更新公告',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

export default async function UpdatesManagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }
  if (!session.user.isAdmin) {
    notFound();
  }

  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-bold tracking-tight">管理更新公告</h1>
        <UpdatesManager />
      </main>
      <Footer />
    </div>
  );
}
