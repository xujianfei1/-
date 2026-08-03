/**
 * 公共示例 - 3 个 demo 按钮
 * 不需登录, 直接从 Flask 拉
 */
'use client';

import { useState } from 'react';
import { Loader2, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import type { DemoCaseResponse } from '@/lib/period-types';

interface Props {
  onLoaded: (r: DemoCaseResponse) => void;
}

const CASES = [
  { id: 1, name: '规律 28 天', desc: '普通模式, 周期非常规律' },
  { id: 2, name: '29 天 + 备孕', desc: 'TTC 模式, 重点关注排卵窗' },
  { id: 3, name: '37 天 + PCOS', desc: '避孕模式, 体重波动 + 慢病' },
] as const;

export function DemoCases({ onLoaded }: Props) {
  const [busy, setBusy] = useState<number | null>(null);

  async function load(id: number) {
    setBusy(id);
    try {
      const r = await fetch(`/api/period/demo/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || '加载失败');
      onLoaded(j as DemoCaseResponse);
      toast.success(`已加载示例 ${id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          没数据?先试个示例
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {CASES.map((c) => (
          <Button
            key={c.id}
            variant="outline"
            size="sm"
            onClick={() => load(c.id)}
            disabled={busy !== null}
            className="flex-col items-start gap-0.5 h-auto py-2"
          >
            <span className="flex items-center gap-1.5 font-medium">
              {busy === c.id && <Loader2 className="h-3 w-3 animate-spin" />}
              示例 {c.id}
            </span>
            <span className="text-[10px] text-text-muted">
              {c.name} · {c.desc}
            </span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
