'use client';

/**
 * 更新公告管理器 (client): 发布表单 + 全量列表 + 删除
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { TYPE_META, type ChangelogType } from '@/lib/changelog-validations';
import { formatDateTime } from '@/lib/utils';

type Entry = {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: Date | string;
};

export function UpdatesManager() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<ChangelogType>('feature');

  const load = useCallback(async () => {
    const r = await fetch('/api/updates');
    if (r.status === 401) {
      router.push('/signin');
      return;
    }
    const j = await r.json().catch(() => ({ data: [] }));
    setEntries(j.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, type }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || '发布失败');
        return;
      }
      toast.success('已发布');
      setTitle('');
      setBody('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('确定删除这条更新公告?')) return;
    const r = await fetch(`/api/updates/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) {
      toast.error('删除失败');
      return;
    }
    toast.success('已删除');
    setEntries((es) => es.filter((e) => e.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* 发布表单 */}
      <section className="w-full shrink-0 rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_8px_24px_-16px_rgba(0,0,0,0.10)] dark:border-white/[0.06] lg:w-[420px]">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题, 如: 博客 v2 上线"
              maxLength={120}
              className="min-w-0 flex-1 rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm font-medium text-text outline-none focus:border-accent"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ChangelogType)}
              className="rounded-lg border border-border/30 bg-bg px-2.5 py-2 text-sm text-text"
            >
              {Object.entries(TYPE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={'内容 (支持 Markdown)…\n- 新增了什么\n- 修了什么'}
            rows={8}
            maxLength={5000}
            className="w-full resize-y rounded-lg border border-border/30 bg-bg px-3 py-2 font-mono text-sm leading-relaxed text-text outline-none focus:border-accent"
          />
          <button
            onClick={submit}
            disabled={submitting || !title.trim() || !body.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            发布
          </button>
        </div>
      </section>

      {/* 列表 */}
      <section className="min-w-0 flex-1">
        <ul className="flex flex-col gap-3">
          {loading && (
            <li className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载中…
            </li>
          )}
          {!loading && entries.length === 0 && (
            <li className="text-sm text-text-muted">还没有更新记录。</li>
          )}
          {entries.map((e) => {
            const meta = TYPE_META[e.type as ChangelogType] ?? TYPE_META.notice;
            return (
              <li
                key={e.id}
                className="group relative rounded-2xl border border-black/[0.06] bg-surface p-4 dark:border-white/[0.06]"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <h2 className="truncate text-sm font-semibold text-text">{e.title}</h2>
                  <time className="ml-auto shrink-0 text-xs text-text-faint">
                    {formatDateTime(e.createdAt)}
                  </time>
                  <button
                    onClick={() => remove(e.id)}
                    className="rounded p-1 text-text-faint opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-1.5 line-clamp-2 pl-0.5 text-xs text-text-muted">{e.body}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
