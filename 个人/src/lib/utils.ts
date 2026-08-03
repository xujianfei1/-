/**
 * 通用工具
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, locale = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string, locale = 'zh-CN'): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getGreeting(hour: number = new Date().getHours()): { greeting: string; subhead: string } {
  if (hour < 5)        return { greeting: '夜深了', subhead: '注意休息,明天继续' };
  if (hour < 9)        return { greeting: '早上好', subhead: '新的一天,从这里开始' };
  if (hour < 12)       return { greeting: '上午好', subhead: '保持专注,慢慢来' };
  if (hour < 14)       return { greeting: '中午好', subhead: '记得吃午饭哦' };
  if (hour < 18)       return { greeting: '下午好', subhead: '还有半天,加油' };
  if (hour < 22)       return { greeting: '晚上好', subhead: '欢迎回来,今天想去哪里?' };
  return { greeting: '夜深了', subhead: '该休息啦' };
}

export function isValidUrl(s: string): boolean {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([\/?#].*)?$/.test(s) && s.includes('.') && !/\s/.test(s);
}
