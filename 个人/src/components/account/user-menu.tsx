/**
 * Topbar 头像菜单
 * - 已登录: 点头像弹 dropdown (账号设置 / 登出 / 注销)
 * - 未登录: 点头像跳 /signin
 *
 * session 状态由 useSession() 客户端拉, 不依赖父组件传 prop.
 */
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Settings, LogOut, LogIn, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SettingsPanel } from './settings-panel';

export function UserMenu() {
  const { data: session, status } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 加载中: 渲染一个静态头像 (避免跳动)
  if (status === 'loading') {
    return (
      <Avatar className="h-9 w-9">
        <AvatarFallback>·</AvatarFallback>
      </Avatar>
    );
  }

  // 未登录: 跳 signin
  if (!session?.user) {
    return (
      <Link
        href="/signin"
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 bg-surface px-3 text-xs text-text-muted transition-colors hover:border-border hover:text-text"
      >
        <LogIn className="h-3.5 w-3.5" />
        登录
      </Link>
    );
  }

  const displayName = session.user.name?.trim() || session.user.email || '?';
  const initials = displayName.slice(0, 1).toUpperCase();
  const image = session.user.image;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="账号菜单"
        >
          <Avatar className="h-9 w-9 cursor-pointer transition-opacity hover:opacity-80">
            {image ? <AvatarImage src={image} alt={displayName} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="!py-2">
            <div className="truncate text-sm font-medium">{displayName}</div>
            {session.user.email && displayName !== session.user.email && (
              <div className="truncate text-[11px] text-text-muted">{session.user.email}</div>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
            <Settings className="mr-2 h-3.5 w-3.5" />
            账号设置
          </DropdownMenuItem>
          {session.user.isAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield className="mr-2 h-3.5 w-3.5" />
                Admin 控制台
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              void signOut({ callbackUrl: '/signin' });
            }}
            className="text-text-muted"
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            登出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
