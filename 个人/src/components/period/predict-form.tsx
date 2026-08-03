/**
 * 预测表单
 * - mode: normal | ttc | contraception
 * - pmsDays 滑块 0~14
 * - specialFactors: 体重 / 睡眠 / 激素药 / 流产
 * - chronicConditions: 自由输入
 */
'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { PredictionResult, PredictMode } from '@/lib/period-types';

interface FormState {
  lmp: string;
  periodDays: number;
  mode: PredictMode;
  pmsDays: number;
  weightChange: boolean;
  sleepDisorder: boolean;
  hormoneDrugs: boolean;
  recentAbortion: boolean;
  chronicConditionsText: string;
}

const DEFAULT: FormState = {
  lmp: '',
  periodDays: 5,
  mode: 'normal',
  pmsDays: 7,
  weightChange: false,
  sleepDisorder: false,
  hormoneDrugs: false,
  recentAbortion: false,
  chronicConditionsText: '',
};

async function postPredict(body: unknown): Promise<PredictionResult> {
  const r = await fetch('/api/period/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || '预测失败');
  return j.data as PredictionResult;
}

export function PredictForm({ onResult }: { onResult: (r: PredictionResult | null) => void }) {
  const [s, setS] = useState<FormState>(DEFAULT);

  const predict = useMutation({
    mutationFn: postPredict,
    onSuccess: (data) => {
      onResult(data);
      if (data.warnings.length) {
        toast.warning(`有 ${data.warnings.length} 条提示`);
      } else {
        toast.success('预测完成');
      }
    },
    onError: (e) => {
      onResult(null);
      toast.error((e as Error).message);
    },
  });

  function submit() {
    predict.mutate({
      ...(s.lmp ? { lmp: s.lmp } : {}),
      periodDays: s.periodDays,
      mode: s.mode,
      pmsDays: s.pmsDays,
      specialFactors: {
        weightChange: s.weightChange,
        sleepDisorder: s.sleepDisorder,
        hormoneDrugs: s.hormoneDrugs,
        recentAbortion: s.recentAbortion,
      },
      chronicConditions: s.chronicConditionsText
        .split(/[,，]/)
        .map((x) => x.trim())
        .filter(Boolean),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>预测参数</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* LMP + 经期天数 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            LMP (留空用最近记录)
            <Input
              type="date"
              value={s.lmp}
              onChange={(e) => setS({ ...s, lmp: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            经期天数
            <Input
              type="number"
              min={1}
              max={10}
              value={s.periodDays}
              onChange={(e) => setS({ ...s, periodDays: Number(e.target.value) || 5 })}
            />
          </label>
        </div>

        {/* 模式 */}
        <div>
          <p className="mb-2 text-xs text-text-muted">预测模式</p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: 'normal', l: '普通', d: '通用预测' },
                { v: 'ttc', l: '备孕 (TTC)', d: '重点排卵窗' },
                { v: 'contraception', l: '避孕', d: '重点安全期' },
              ] as { v: PredictMode; l: string; d: string }[]
            ).map((m) => (
              <button
                key={m.v}
                type="button"
                onClick={() => setS({ ...s, mode: m.v })}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  s.mode === m.v
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border bg-surface hover:bg-surface-hover'
                }`}
              >
                <div className="font-medium">{m.l}</div>
                <div className="text-[10px] text-text-muted">{m.d}</div>
              </button>
            ))}
          </div>
        </div>

        {/* PMS 滑块 */}
        <label className="block text-xs text-text-muted">
          PMS 预警天数: <span className="font-mono text-text">{s.pmsDays}</span>
          <input
            type="range"
            min={0}
            max={14}
            value={s.pmsDays}
            onChange={(e) => setS({ ...s, pmsDays: Number(e.target.value) })}
            className="mt-1 w-full accent-accent"
          />
        </label>

        {/* 特殊因素 */}
        <div>
          <p className="mb-2 text-xs text-text-muted">特殊因素 (会调整预测误差)</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {(
              [
                ['weightChange', '近期体重骤变'],
                ['sleepDisorder', '睡眠紊乱'],
                ['hormoneDrugs', '服用激素类药物'],
                ['recentAbortion', '近期流产 / 手术'],
              ] as [keyof FormState, string][]
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(s[k])}
                  onChange={(e) => setS({ ...s, [k]: e.target.checked })}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
                />
                <span>{l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 慢性病 */}
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          慢性病 (逗号分隔, 如: PCOS, 甲减)
          <Input
            value={s.chronicConditionsText}
            onChange={(e) => setS({ ...s, chronicConditionsText: e.target.value })}
            placeholder="PCOS, 甲状腺..."
          />
        </label>

        <Button onClick={submit} disabled={predict.isPending} className="w-full">
          {predict.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          开始预测
        </Button>
      </CardContent>
    </Card>
  );
}
