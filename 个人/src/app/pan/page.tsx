/**
 * /pan - 云盘主页 (私人文件根目录)
 * - RSC, 服务端 await auth() 检查登录态
 * - 未登录跳 /signin
 * - 子域访问 (pan.xujianfei.cn) 时, 顶部加 "返回门户" 链接
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { HeroBackdrop } from '@/components/hero-backdrop';
import { PanClient } from '@/components/pan/pan-client';
import { portalUrlFor } from '@/lib/portal-url';

export const metadata = {
  title: '云盘',
  description: '私人文件存储 · 共享池',
};

export const dynamic = 'force-dynamic';

export default async function PanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }
  const hdrs = await headers();
  const portalUrl = portalUrlFor(hdrs.get('host'));

  return (
    <div className="relative flex min-h-screen flex-col">
      <HeroBackdrop
        className="h-[300px] md:h-[340px]"
        scrim="bg-gradient-to-b from-black/55 via-black/35 to-transparent"
      />
      <div className="relative">
      <Topbar portalUrl={portalUrl} />
      <main className="flex-1">
        <PanClient
          userId={session.user.id}
          userName={session.user.name ?? ''}
          portalUrl={portalUrl}
        />
      </main>
      <Footer />
      </div>
    </div>
  );
}
