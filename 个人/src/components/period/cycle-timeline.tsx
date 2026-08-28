/**
 * 周期时间轴 - 横向可视化
 * - 节点: 每次经期首日 (玫瑰色圆点)
 * - 线段: 相邻周期间隔, 颜色按长度编码
 * - 刻度: 月份
 * - 今日竖线
 */
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Cycle } from '@/lib/period-types';

const DAY_MS = 86_400_000;
const PAD_DAYS = 30;
const PX_PER_DAY = 6;
const ROW_H = 110;

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type GapClass = 'normal' | 'short' | 'long';

function classifyGap(days: number): GapClass {
  if (days < 21) return 'short';
  if (days > 35) return 'long';
  return 'normal';
}

const GAP_BAR: Record<GapClass, string> = {
  normal: 'bg-emerald-500',
  short:  'bg-amber-500',
  long:   'bg-fuchsia-500',
};
const GAP_LABEL: Record<GapClass, string> = {
  normal: '正常',
  short:  '偏短',
  long:   '偏长',
};

export function CycleTimeline({ cycles }: { cycles: Cycle[] }) {
  const [hoverId, setHoverId] = useState<number | null>(null);

  if (cycles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>周期时间轴</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            还没有记录。先在上方表单新增一条, 或点「示例 1/2/3」, 这里会展示周期分布。
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = cycles.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const firstMs = new Date(sorted[0]!.startDate).getTime();
  const lastRecMs = new Date(sorted[sorted.length - 1]!.startDate).getTime();
  const todayMs = new Date(todayISO()).getTime();
  const endMs = Math.max(lastRecMs, todayMs) + PAD_DAYS * DAY_MS;
  const startMs = firstMs - PAD_DAYS * DAY_MS;
  const totalDays = Math.ceil((endMs - startMs) / DAY_MS);
  const widthPx = Math.max(640, totalDays * PX_PER_DAY);

  const xOf = (iso: string) =>
    Math.round((new Date(iso).getTime() - startMs) / DAY_MS * PX_PER_DAY);

  const segments = sorted.slice(1).map((c, i) => {
    const prev = sorted[i]!;
    return { from: prev, to: c, gap: daysBetween(prev.startDate, c.startDate) };
  });

  // 月份刻度
  const months: { x: number; label: string }[] = [];
  const c = new Date(startMs);
  c.setDate(1);
  c.setHours(0, 0, 0, 0);
  while (c.getTime() <= endMs) {
    months.push({
      x: Math.round((c.getTime() - startMs) / DAY_MS * PX_PER_DAY),
      label: `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}`,
    });
    c.setMonth(c.getMonth() + 1);
  }

  const todayX = Math.round((todayMs - startMs) / DAY_MS * PX_PER_DAY);

  // 波动判定
  const recent3 = segments.slice(-3).map((s) => s.gap);
  const isErratic = recent3.length >= 3 && Math.max(...recent3) - Math.min(...recent3) > 7;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>周期时间轴</span>
          {isErratic && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">
              近 3 个周期波动 {Math.max(...recent3) - Math.min(...recent3)} 天
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
          <Legend color="bg-emerald-500" text="正常 21~35 天" />
          <Legend color="bg-amber-500" text="偏短 <21 天" />
          <Legend color="bg-fuchsia-500" text="偏长 >35 天" />
          <span className="ml-auto">
            共 {sorted.length} 条记录 ·{' '}
            {segments.length > 0 && (
              <>平均 {(segments.reduce((a, s) => a + s.gap, 0) / segments.length).toFixed(1)} 天</>
            )}
          </span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-bg-soft/40">
          <div className="relative" style={{ width: widthPx, height: ROW_H }}>
            {/* 月份刻度 */}
            <div className="absolute inset-x-0 top-0 h-6 border-b border-border/60">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 h-full" style={{ left: m.x }}>
                  <div className="h-2 w-px bg-border" />
                  <div className="ml-1 text-[10px] text-text-muted">{m.label}</div>
                </div>
              ))}
            </div>

            {/* 主线 (基准) */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />

            {/* 周期线段 + 长度标签 */}
            {segments.map((s, i) => {
              const x1 = xOf(s.from.startDate);
              const x2 = xOf(s.to.startDate);
              const cls = classifyGap(s.gap);
              return (
                <div key={i}>
                  <div
                    className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded ${GAP_BAR[cls]} opacity-70`}
                    style={{ left: x1, width: Math.max(2, x2 - x1) }}
                    title={`${s.from.startDate} → ${s.to.startDate} · ${s.gap} 天`}
                  />
                  <div
                    className="absolute -translate-x-1/2 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[10px] font-medium text-text"
                    style={{ left: (x1 + x2) / 2, top: 14 }}
                  >
                    {s.gap}天
                    <span className={`ml-1 ${cls === 'normal' ? 'text-emerald-600' : cls === 'short' ? 'text-amber-600' : 'text-fuchsia-600'}`}>
                      ·{GAP_LABEL[cls]}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* 节点 */}
            {sorted.map((c) => {
              const x = xOf(c.startDate);
              const isHover = hoverId === c.id;
              return (
                <div
                  key={c.id}
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: x }}
                  onMouseEnter={() => setHoverId(c.id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <div
                    className={`h-3.5 w-3.5 rounded-full bg-rose-500 ring-2 transition-transform ${
                      isHover ? 'ring-rose-300 scale-125' : 'ring-bg'
                    }`}
                  />
                  <div
                    className={`absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-bg px-2 py-1 text-[10px] shadow-sm ${
                      isHover ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <div className="font-medium">{c.startDate}</div>
                    <div className="text-text-muted">经期 {c.periodDays} 天</div>
                    {c.notes && <div className="text-text-muted">备注: {c.notes}</div>}
                  </div>
                </div>
              );
            })}

            {/* 今日竖线 */}
            {todayX >= 0 && todayX <= widthPx && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-sky-500"
                style={{ left: todayX }}
              >
                <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 rounded-b-md bg-sky-500 px-1.5 text-[10px] font-medium text-white">
                  今天
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-4 rounded-sm ${color}`} />
      <span>{text}</span>
    </div>
  );
}
