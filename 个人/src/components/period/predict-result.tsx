/**
 * 预测结果展示
 * - 当前阶段指示器
 * - 关键统计卡片
 * - 阶段时间线
 * - 阶段详情卡
 * - 警告 + 模式贴士
 */
'use client';

import { AlertTriangle, Calendar, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PredictionResult } from '@/lib/period-types';
import { PHASE_COLORS, REGULARITY_LABEL, CONFIDENCE_LABEL } from './phase-colors';

function fmt(d: string) {
  // YYYY-MM-DD -> 5/20
  const [, m, day] = d.split('-').map(Number);
  return `${m}/${day}`;
}

export function PredictResult({ result }: { result: PredictionResult | null }) {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>预测结果</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-muted">
            填写左侧参数并点击「开始预测」,或先试一个示例。
          </p>
        </CardContent>
      </Card>
    );
  }

  const cur = result.currentCycle;
  const curColor = PHASE_COLORS[cur.currentPhase] || PHASE_COLORS.follicular;
  const pred = result.prediction;
  const stats = result.cycleStats;
  const phases = result.phases;
  const overdue = result.overdueInfo;

  return (
    <div className="space-y-4">
      {/* 当前阶段指示器 */}
      <Card className={`${curColor.bgSoft} ${curColor.border} border`}>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${curColor.dot}`} />
            <div>
              <p className={`text-xs uppercase tracking-wide ${curColor.text}`}>
                当前阶段
              </p>
              <p className={`text-2xl font-semibold ${curColor.text}`}>
                {curColor.label}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Stat icon={<Activity className="h-4 w-4" />} label="周期第" value={`${cur.dayOfCycle} 天`} />
            <Stat
              icon={<Calendar className="h-4 w-4" />}
              label="距离下次"
              value={`${cur.daysUntilNextPeriod} 天`}
            />
            <Stat
              icon={<TrendingUp className="h-4 w-4" />}
              label="可信度"
              value={CONFIDENCE_LABEL[pred.confidence] ?? pred.confidence}
            />
          </div>
        </CardContent>
      </Card>

      {/* 关键统计 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="下次经期" value={pred.nextPeriodStart} hint={`经期至 ${pred.nextPeriodEnd}`} />
        <StatCard
          label="平均周期"
          value={`${stats.avgCycle} 天`}
          hint={`区间 ${stats.minCycle}~${stats.maxCycle}`}
        />
        <StatCard
          label="标准差"
          value={`±${stats.stdDev}`}
          hint={`规律度 ${REGULARITY_LABEL[stats.regularityLevel] ?? stats.regularityLevel}`}
        />
        <StatCard
          label="误差范围"
          value={`±${pred.errorDays} 天`}
          hint={`${pred.confidenceInterval.earliest} ~ ${pred.confidenceInterval.latest}`}
        />
      </div>

      {/* 过期提示 */}
      {overdue.isOverdue && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/40">
          <CardContent className="flex items-start gap-2 p-4 text-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">已逾期 {overdue.overdueDays} 天</p>
              {overdue.suggestion && <p className="mt-1 text-xs">{overdue.suggestion}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 阶段时间线 */}
      <Card>
        <CardHeader>
          <CardTitle>阶段时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <PhaseBar name="menstrual" range={phases.menstrual} />
            <PhaseBar name="follicular" range={phases.follicular} />
            <PhaseBar name="ovulation" range={phases.ovulation} />
            <PhaseBar name="luteal" range={phases.luteal} />
            <PhaseBar name="pms" range={phases.pms} />
          </div>
        </CardContent>
      </Card>

      {/* 排卵详情 */}
      <Card>
        <CardHeader>
          <CardTitle>排卵详情</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            排卵日: <span className="font-medium">{phases.ovulation.ovulationDay}</span>
          </p>
          <p>
            最佳受孕窗口:{' '}
            <span className="font-medium">{phases.ovulation.bestDays.join(' · ')}</span>
          </p>
        </CardContent>
      </Card>

      {/* 警告 + 模式贴士 */}
      {result.warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>提示</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {result.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      w.level === 'danger'
                        ? 'text-destructive'
                        : w.level === 'warning'
                        ? 'text-amber-500'
                        : 'text-blue-500'
                    }`}
                  />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.modeInfo.tips.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {result.modeInfo.mode === 'ttc' ? '备孕贴士' : result.modeInfo.mode === 'contraception' ? '避孕贴士' : '通用贴士'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-text-muted">
              {result.modeInfo.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {result.specialNote && (
        <Card>
          <CardContent className="p-4 text-sm text-text-muted">{result.specialNote}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-text-muted">{icon}</span>
      <div className="leading-tight">
        <p className="text-[10px] uppercase text-text-muted">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[10px] uppercase text-text-muted">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-text-muted">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function PhaseBar({ name, range }: { name: keyof typeof PHASE_COLORS; range: { start: string; end: string } }) {
  const c = PHASE_COLORS[name];
  return (
    <div className={`rounded-lg border ${c.border} ${c.bgSoft} p-2`}>
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${c.dot}`} />
        <span className={`text-[11px] font-medium ${c.text}`}>{c.label}</span>
      </div>
      <p className="mt-1 font-mono text-[11px] text-text-muted">
        {fmt(range.start)} ~ {fmt(range.end)}
      </p>
    </div>
  );
}
