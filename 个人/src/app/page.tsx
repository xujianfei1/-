import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { Greeting } from '@/components/home/greeting';
import { SearchBox } from '@/components/home/search-box';
import { ServiceGrid } from '@/components/home/service-grid';
import { QuickLinks } from '@/components/home/quick-links';
import { RecentUpdates } from '@/components/home/recent-updates';
import { getServices, getOnlineServices } from '@/server/services';
import { getLinks } from '@/server/links';
import { getChangelogs } from '@/server/changelogs';

/**
 * 主页 (RSC)
 * - 服务端获取数据 (DB 直读, 无需 API 往返)
 * - 客户端组件通过 data-* 属性与服务端组件交互 (搜索过滤)
 * - 后续扩展: 加分类 (group by category)、加访问统计 (VisitLog)、加用户收藏等
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [allServices, onlineServices, links, updates] = await Promise.all([
    getServices(),
    getOnlineServices(),
    getLinks(),
    getChangelogs(3),
  ]);

  return (
    <div className="container flex min-h-screen flex-col py-6 md:py-10">
      <Topbar />
      <main className="flex flex-1 flex-col gap-10 md:gap-14">
        <Greeting />
        <SearchBox />
        <ServiceGrid services={allServices} onlineCount={onlineServices.length} />
        <QuickLinks links={links} />
        <RecentUpdates entries={updates} />
      </main>
      <Footer />
    </div>
  );
}
