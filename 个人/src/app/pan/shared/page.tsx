/**
 * /pan/shared - 共享池入口
 * - 跟 /pan/page.tsx 同结构, 但默认 scope=shared
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { PanClient } from '@/components/pan/pan-client';
import { portalUrlFor } from '@/lib/portal-url';

export const metadata = {
  title: '共享池',
  description: '全员可读写的文件池',
};

export const dynamic = 'force-dynamic';

export default async function PanSharedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }
  const hdrs = await headers();
  const portalUrl = portalUrlFor(hdrs.get('host'));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar portalUrl={portalUrl} />
      <main className="flex-1">
        <PanClient
          userId={session.user.id}
          userName={session.user.name ?? ''}
          portalUrl={portalUrl}
          initialScope="shared"
        />
      </main>
      <Footer />
    </div>
  );
}
