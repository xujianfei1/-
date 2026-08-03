import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { APP_NAME } from '@/lib/constants';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

/**
 * 子域访问 (如 period.xujianfei.cn) 时, 顶左 logo 跳门户主域 me.xujianfei.cn/
 * 同域访问时跳根 /
 */
export function Topbar({ portalUrl }: { portalUrl?: string | null } = {}) {
  const homeHref = portalUrl ?? '/';
  const isExternal = !!portalUrl;
  const brand = (
    <span className="flex items-center gap-2 group">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-amber-400 text-sm font-bold text-white shadow-sm shadow-accent/30 transition-transform group-hover:scale-110">
        ✦
      </span>
      <span className="text-sm font-semibold">{APP_NAME}</span>
    </span>
  );

  return (
    <header className="flex items-center justify-between mb-12 animate-fade-in">
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
        <Avatar className="h-9 w-9 cursor-pointer">
          <AvatarFallback>我</AvatarFallback>
        </Avatar>
      </nav>
    </header>
  );
}
