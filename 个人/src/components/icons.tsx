/**
 * 图标库
 * 数据库存 lucide 图标名 (字符串), 这里根据名字渲染对应组件
 * 品牌图标以 brand- 前缀存库, 走官方矢量 (simple-icons)
 * 用法: import { IconByName } from '@/components/icons'; <IconByName name="home" />
 */
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  CalendarHeart,
  Feather,
  Cloud,
  Pencil,
  Folder,
  BookOpen,
  NotebookPen,
  Share2,
  Upload,
  Plus,
  Github,
  Bot,
  Notebook,
  MessagesSquare,
  Link as LinkIcon,
  type LucideIcon,
} from 'lucide-react';
import { BrandIcon } from '@/components/brand-icons';

const ICON_MAP: Record<string, LucideIcon> = {
  home: Home,
  'layout-dashboard': LayoutDashboard,
  'shopping-cart': ShoppingCart,
  'calendar-heart': CalendarHeart,
  feather: Feather,
  cloud: Cloud,
  pencil: Pencil,
  folder: Folder,
  'book-open': BookOpen,
  'notebook-pen': NotebookPen,
  'share-2': Share2,
  upload: Upload,
  plus: Plus,
  github: Github,
  bot: Bot,
  notebook: Notebook,
  'messages-square': MessagesSquare,
  link: LinkIcon,
};

export function IconByName({ name, className }: { name: string; className?: string }) {
  if (name.startsWith('brand-')) {
    return <BrandIcon name={name} className={className} />;
  }
  const Icon = ICON_MAP[name] ?? Plus;
  return <Icon className={className} />;
}

export { ICON_MAP };
