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
import { heroSrcNow } from '@/lib/hero-bg';
import { preload } from 'react-dom';

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
  const heroSrc = heroSrcNow();
  preload(heroSrc, { as: 'image' });

  return (
    <div className="relative">
      {/* 电影感 hero 背景: 每小时轮换的时段主题剧照 */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden animate-fade-in md:h-[640px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroSrc} alt="" className="h-full w-full object-cover" />
        {/* 压暗 scrim: 保证导航/标题/搜索可读 */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-transparent" />
        {/* 底部融入页面背景色 */}
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-b from-transparent to-bg" />
      </div>

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
