/**
 * 经期预测页 - 客户端根
 * 布局: 左侧 (周期记录 + 预测参数 + 示例)  |  右侧 (预测结果)
 */
'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { CycleSection } from './cycle-section';
import { PredictForm } from './predict-form';
import { PredictResult } from './predict-result';
import { DemoCases } from './demo-cases';
import type { DemoCaseResponse, PredictionResult } from '@/lib/period-types';

interface Props {
  userId: string;
  userName: string;
  /** 子域访问时, 给一个 "返回门户" 的链接目标; 同域访问传 null */
  portalUrl: string | null;
}

export function PeriodClient({ userName, portalUrl }: Props) {
  const [result, setResult] = useState<PredictionResult | null>(null);

  function handleDemo(d: DemoCaseResponse) {
    setResult(d.data);
  }

  return (
    <div className="container py-6 md:py-10">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          {portalUrl && (
            <Link
              href={portalUrl}
              className="mb-2 inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent"
            >
              <ArrowLeft className="h-3 w-3" />
              返回个人门户
            </Link>
          )}
          <h1 className="text-2xl font-semibold">经期预测</h1>
          <p className="text-sm text-text-muted">
            {userName ? `${userName} 的预测结果` : '基于历史周期的智能预测'}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左: 输入 */}
        <div className="space-y-4">
          <CycleSection onChanged={() => setResult(null)} />
          <DemoCases onLoaded={handleDemo} />
          <PredictForm onResult={setResult} />
        </div>
        {/* 右: 输出 */}
        <div>
          <PredictResult result={result} />
        </div>
      </div>
    </div>
  );
}
