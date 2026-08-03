/**
 * /period - 经期预测页
 * - RSC, 服务端 await auth() 检查登录态
 * - 未登录跳 /signin
 * - 子域访问 (period.xujianfei.cn) 时, 顶部加 "返回门户" 链接
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { PeriodClient } from '@/components/period/period-client';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { portalUrlFor } from '@/lib/portal-url';

export const metadata = {
  title: '经期预测',
  description: '基于历史周期的智能经期预测',
};

export const dynamic = 'force-dynamic';

export default async function PeriodPage() {
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
        <PeriodClient
          userId={session.user.id}
          userName={session.user.name ?? ''}
          portalUrl={portalUrl}
        />
      </main>
      <Footer />
    </div>
  );
}
