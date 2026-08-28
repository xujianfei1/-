import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/components/account/user-menu';
import { APP_NAME } from '@/lib/constants';

/**
 * 子域访问 (如 period.xujianfei.cn) 时, 顶左 logo 跳门户主域 xujianfei.cn/
 * 同域访问时跳根 /
 * 悬浮胶囊导航: sticky + 毛玻璃
 */
export function Topbar({ portalUrl }: { portalUrl?: string | null } = {}) {
  const homeHref = portalUrl ?? '/';
  const isExternal = !!portalUrl;
  const brand = (
    <span className="flex items-center gap-2.5 group">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-amber-400 text-sm font-bold text-white shadow-md shadow-accent/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        ✦
      </span>
      <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );

  return (
    <header className="sticky top-3 z-40 mb-10 animate-fade-in">
      <div className="flex items-center justify-between rounded-2xl border border-border/30 bg-bg/75 px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-12px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        {isExternal ? (
          <a href={homeHref} className="flex items-center" rel="noopener noreferrer">
            {brand}
          </a>
        ) : (
          <Link href={homeHref} className="flex items-center">
            {brand}
          </Link>
        )}

        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
