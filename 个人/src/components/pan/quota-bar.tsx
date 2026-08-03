/**
 * 配额使用条
 */
'use client';

import { useQuery } from '@tanstack/react-query';
import { HardDrive } from 'lucide-react';

interface QuotaData {
  used: string;
  limit: string;
}

async function fetchQuota(): Promise<QuotaData> {
  const r = await fetch('/api/pan/quota', { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '加载配额失败');
  return j.data as QuotaData;
}

function fmt(bytesStr: string): string {
  const n = Number(bytesStr);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function QuotaBar() {
  const { data, isPending, error } = useQuery({ queryKey: ['pan', 'quota'], queryFn: fetchQuota });

  if (isPending) {
    return <div className="mb-4 h-2 animate-pulse rounded-full bg-accent-soft" />;
  }
  if (error || !data) {
    return null;
  }
  const usedN = Number(data.used);
  const limitN = Number(data.limit);
  const pct = limitN > 0 ? Math.min(100, Math.round((usedN / limitN) * 100)) : 0;
  const warn = pct >= 80;

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface p-3">
      <div className="mb-1 flex items-center gap-2 text-xs text-text-muted">
        <HardDrive className="h-3.5 w-3.5" />
        <span>
          已用 <span className="font-medium text-text">{fmt(data.used)}</span> / {fmt(data.limit)} (
          {pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent-soft">
        <div
          className={`h-full rounded-full transition-all ${warn ? 'bg-danger' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
