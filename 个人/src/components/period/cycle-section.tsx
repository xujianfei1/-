/**
 * 周期记录区 - 列表 + 新增 + 删除
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Cycle } from '@/lib/period-types';
import { CycleTimeline } from './cycle-timeline';

async function fetchCycles(): Promise<Cycle[]> {
  const r = await fetch('/api/period/cycles', { cache: 'no-store' });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '加载周期失败');
  return j.data as Cycle[];
}

async function postCycle(body: { startDate: string; periodDays: number; notes?: string }): Promise<Cycle> {
  const r = await fetch('/api/period/cycles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '创建失败');
  return j.data as Cycle;
}

async function deleteCycle(id: number): Promise<void> {
  const r = await fetch(`/api/period/cycles/${id}`, { method: 'DELETE' });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || '删除失败');
  }
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function CycleSection({ onChanged }: { onChanged?: () => void }) {
  const qc = useQueryClient();
  const cyclesQ = useQuery({ queryKey: ['cycles'], queryFn: fetchCycles });

  const create = useMutation({
    mutationFn: postCycle,
    onSuccess: (c) => {
      toast.success(`已记录 ${c.startDate}`);
      qc.invalidateQueries({ queryKey: ['cycles'] });
      qc.invalidateQueries({ queryKey: ['history'] });
      onChanged?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: deleteCycle,
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['cycles'] });
      qc.invalidateQueries({ queryKey: ['history'] });
      onChanged?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>我的周期记录</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 新增表单 */}
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            create.mutate({
              startDate: String(fd.get('startDate') || ''),
              periodDays: Number(fd.get('periodDays') || 5),
              notes: String(fd.get('notes') || '').trim() || undefined,
            });
            (e.target as HTMLFormElement).reset();
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            末次月经首日
            <Input type="date" name="startDate" max={todayISO()} required className="w-44" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            经期天数
            <Input type="number" name="periodDays" min={1} max={10} defaultValue={5} className="w-20" />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-text-muted min-w-[180px]">
            备注 (可选)
            <Input name="notes" placeholder="如: 提前 / 推迟 / 异常" />
          </label>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            新增
          </Button>
        </form>

        {/* 列表 */}
        {cyclesQ.isLoading && <p className="text-sm text-text-muted">加载中…</p>}
        {cyclesQ.error && (
          <p className="text-sm text-destructive">加载失败: {(cyclesQ.error as Error).message}</p>
        )}
        {cyclesQ.data && cyclesQ.data.length === 0 && (
          <p className="text-sm text-text-muted">还没有记录。先在下方点一个示例看效果,或手动新增一条。</p>
        )}
        {cyclesQ.data && cyclesQ.data.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {cyclesQ.data
              .slice()
              .sort((a, b) => b.startDate.localeCompare(a.startDate))
              .map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{c.startDate}</span>
                    <span className="text-xs text-text-muted">
                      经期 {c.periodDays} 天
                      {c.notes ? ` · ${c.notes}` : ''}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => del.mutate(c.id)}
                    disabled={del.isPending}
                    aria-label="删除"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
          </ul>
        )}

        {/* 时间轴可视化 */}
        {cyclesQ.data && cyclesQ.data.length > 0 && (
          <div className="pt-2">
            <CycleTimeline cycles={cyclesQ.data} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
