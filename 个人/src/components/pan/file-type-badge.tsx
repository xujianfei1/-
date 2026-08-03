/**
 * 文件类型 → 图标 + 配色
 *
 * 返回 lucide 图标组件 + 颜色 token, 用在 file-row / 分享视图 / 公开页等.
 * 颜色用 HSL string 直接喂给 Tailwind (走 arbitrary value 通道).
 */
import {
  FileText, Image as ImageIcon, Film, Music, FileSpreadsheet,
  FileCode, FileArchive, File as FileGeneric, Folder as FolderIcon,
  FileType, Presentation,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface FileTypeStyle {
  Icon: LucideIcon;
  /** Tailwind bg-color 用的 HSL 字符串 (from --accent) */
  bg: string;
  /** icon 颜色 (text-) */
  fg: string;
  /** 边框/微调色 */
  ring: string;
  /** 短标签 */
  label: string;
}

/** 已知类型定义 */
const TYPE_TABLE: Array<{ test: (name: string, mime: string | null) => boolean; style: FileTypeStyle }> = [
  {
    test: (_, m) => !!m && m.startsWith('image/'),
    style: {
      Icon: ImageIcon, bg: 'bg-rose-100 dark:bg-rose-950/40',
      fg: 'text-rose-600 dark:text-rose-400', ring: 'ring-rose-200/60 dark:ring-rose-900/60',
      label: '图片',
    },
  },
  {
    test: (_, m) => !!m && m.startsWith('video/'),
    style: {
      Icon: Film, bg: 'bg-violet-100 dark:bg-violet-950/40',
      fg: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-200/60 dark:ring-violet-900/60',
      label: '视频',
    },
  },
  {
    test: (_, m) => !!m && m.startsWith('audio/'),
    style: {
      Icon: Music, bg: 'bg-sky-100 dark:bg-sky-950/40',
      fg: 'text-sky-600 dark:text-sky-400', ring: 'ring-sky-200/60 dark:ring-sky-900/60',
      label: '音频',
    },
  },
  {
    test: (n) => /\.pdf$/i.test(n),
    style: {
      Icon: FileType, bg: 'bg-red-100 dark:bg-red-950/40',
      fg: 'text-red-600 dark:text-red-400', ring: 'ring-red-200/60 dark:ring-red-900/60',
      label: 'PDF',
    },
  },
  {
    test: (n) => /\.(docx?|rtf|odt|pages)$/i.test(n),
    style: {
      Icon: FileText, bg: 'bg-blue-100 dark:bg-blue-950/40',
      fg: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-200/60 dark:ring-blue-900/60',
      label: '文档',
    },
  },
  {
    test: (n) => /\.(xlsx?|csv|ods|numbers)$/i.test(n),
    style: {
      Icon: FileSpreadsheet, bg: 'bg-emerald-100 dark:bg-emerald-950/40',
      fg: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-200/60 dark:ring-emerald-900/60',
      label: '表格',
    },
  },
  {
    test: (n) => /\.(pptx?|key|odp)$/i.test(n),
    style: {
      Icon: Presentation, bg: 'bg-orange-100 dark:bg-orange-950/40',
      fg: 'text-orange-600 dark:text-orange-400', ring: 'ring-orange-200/60 dark:ring-orange-900/60',
      label: '演示',
    },
  },
  {
    test: (n) => /\.(zip|7z|tar|gz|rar|bz2|xz)$/i.test(n),
    style: {
      Icon: FileArchive, bg: 'bg-amber-100 dark:bg-amber-950/40',
      fg: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200/60 dark:ring-amber-900/60',
      label: '压缩包',
    },
  },
  {
    test: (n) => /\.(js|ts|jsx|tsx|py|rs|go|java|c|cpp|h|cs|rb|php|sh|json|ya?ml|toml|html|css|scss|vue|svelte)$/i.test(n),
    style: {
      Icon: FileCode, bg: 'bg-teal-100 dark:bg-teal-950/40',
      fg: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-200/60 dark:ring-teal-900/60',
      label: '代码',
    },
  },
  {
    test: (n) => /\.(txt|md|log)$/i.test(n),
    style: {
      Icon: FileText, bg: 'bg-stone-100 dark:bg-stone-800/60',
      fg: 'text-stone-600 dark:text-stone-400', ring: 'ring-stone-200/60 dark:ring-stone-800',
      label: '文本',
    },
  },
];

/** 目录固定样式 */
export const FOLDER_STYLE: FileTypeStyle = {
  Icon: FolderIcon,
  bg: 'bg-amber-100 dark:bg-amber-950/40',
  fg: 'text-amber-600 dark:text-amber-400',
  ring: 'ring-amber-200/60 dark:ring-amber-900/60',
  label: '文件夹',
};

/** 默认文件样式 */
const DEFAULT_STYLE: FileTypeStyle = {
  Icon: FileGeneric,
  bg: 'bg-stone-100 dark:bg-stone-800/60',
  fg: 'text-stone-500 dark:text-stone-400',
  ring: 'ring-stone-200/60 dark:ring-stone-800',
  label: '文件',
};

export function getFileTypeStyle(name: string, mime: string | null, isDir = false): FileTypeStyle {
  if (isDir) return FOLDER_STYLE;
  for (const entry of TYPE_TABLE) {
    if (entry.test(name, mime)) return entry.style;
  }
  return DEFAULT_STYLE;
}

/** 缩略 size: sm (行内, h-5), md (列表, h-10), lg (卡片, h-16), xl (hero, h-20) */
export function FileTypeBadge({
  name, mime, isDir, size = 'md',
}: {
  name: string; mime: string | null; isDir: boolean; size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const style = getFileTypeStyle(name, mime, isDir);
  const Icon = style.Icon;
  const dim = {
    sm: { box: 'h-7 w-7', icon: 'h-4 w-4' },
    md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
    lg: { box: 'h-14 w-14', icon: 'h-7 w-7' },
    xl: { box: 'h-20 w-20', icon: 'h-10 w-10' },
  }[size];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg ring-1 ${style.bg} ${style.ring} ${dim.box}`}
    >
      <Icon className={`${dim.icon} ${style.fg}`} />
    </div>
  );
}
