/**
 * 图标库
 * 数据库存 lucide 图标名 (字符串), 这里根据名字渲染对应组件
 * 用法: import { IconByName } from '@/components/icons'; <IconByName name="home" />
 */
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  CalendarHeart,
  Pencil,
  Folder,
  BookOpen,
  Upload,
  Plus,
  Github,
  Bot,
  Notebook,
  MessagesSquare,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  'layout-dashboard': LayoutDashboard,
  'shopping-cart': ShoppingCart,
  'calendar-heart': CalendarHeart,
  pencil: Pencil,
  folder: Folder,
  'book-open': BookOpen,
  upload: Upload,
  plus: Plus,
  github: Github,
  bot: Bot,
  notebook: Notebook,
  'messages-square': MessagesSquare,
  link: LinkIcon,
};

export function IconByName({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] ?? Plus;
  return <Icon className={className} />;
}

export { ICON_MAP };
