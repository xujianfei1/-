/**
 * 经期阶段 - 主题色 (light / dark 兼容)
 */
export interface PhaseColor {
  bg: string;
  bgSoft: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

export const PHASE_COLORS = {
  menstrual: {
    bg: 'bg-rose-500 dark:bg-rose-600',
    bgSoft: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-900',
    dot: 'bg-rose-500',
    label: '月经期',
  },
  follicular: {
    bg: 'bg-emerald-500 dark:bg-emerald-600',
    bgSoft: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-900',
    dot: 'bg-emerald-500',
    label: '卵泡期',
  },
  ovulation: {
    bg: 'bg-amber-500 dark:bg-amber-600',
    bgSoft: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
    label: '排卵期',
  },
  luteal: {
    bg: 'bg-sky-500 dark:bg-sky-600',
    bgSoft: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-900',
    dot: 'bg-sky-500',
    label: '黄体期',
  },
  pms: {
    bg: 'bg-fuchsia-500 dark:bg-fuchsia-600',
    bgSoft: 'bg-fuchsia-50 dark:bg-fuchsia-950/40',
    text: 'text-fuchsia-700 dark:text-fuchsia-300',
    border: 'border-fuchsia-200 dark:border-fuchsia-900',
    dot: 'bg-fuchsia-500',
    label: 'PMS 期',
  },
};

export const REGULARITY_LABEL: Record<string, string> = {
  regular: '规律',
  irregular: '不规律',
  very_irregular: '很不规律',
  very_regular: '非常规律',
  unknown: '未知',
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};
