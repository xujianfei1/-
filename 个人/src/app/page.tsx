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
      {/* 全页壁纸: 每小时轮换的时段剧照 (玻璃卡片透出壁纸) */}
      <HeroBackdrop
        fixed
        className="inset-0"
        scrim="bg-gradient-to-b from-black/30 via-black/5 to-black/10 dark:from-black/45 dark:via-black/15 dark:to-black/55"
        fadeToBg={false}
      />
      {/* 下半部纱帘: 渐入页面底色保证可读, 仍保留壁纸微透 */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-transparent via-bg/30 to-bg/85 dark:via-black/5 dark:to-black/60"
      />

      <div className="container relative flex min-h-screen flex-col py-6 md:py-10">
        <Topbar />
        <main className="flex flex-1 flex-col gap-10 md:gap-14 [&_.text-text-muted]:[text-shadow:0_1px_3px_rgba(255,255,255,0.75)] [&_.text-text-faint]:[text-shadow:0_1px_3px_rgba(255,255,255,0.7)] dark:[&_.text-text-muted]:[text-shadow:none] dark:[&_.text-text-faint]:[text-shadow:none]">
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
