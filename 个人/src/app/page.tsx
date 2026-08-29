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
import { HeroBackdrop } from '@/components/hero-backdrop';

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
    <div className="relative">
      {/* 电影感 hero 背景: 每小时轮换的时段主题剧照 */}
      <HeroBackdrop />

      <div className="container relative flex min-h-screen flex-col py-6 md:py-10">
        <Topbar />
        <main className="flex flex-1 flex-col gap-10 md:gap-14">
          {/* hero 区: 白字压图 (linear.app 式), 搜索卡保持原样浮在图上 */}
          <div className="relative z-10 [&_h1]:text-white [&_h1]:drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)] [&_section_p]:text-white/85 [&_.text-text-faint]:text-white/60 [&_.text-text-muted]:text-white/80">
            <Greeting />
            <SearchBox />
          </div>
          <ServiceGrid services={allServices} onlineCount={onlineServices.length} />
          <QuickLinks links={links} />
          <RecentUpdates entries={updates} />
        </main>
        <Footer />
      </div>
    </div>
  );
}
