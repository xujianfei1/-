'use client';

/**
 * 背单词主页 (client): 词书选择 + 今日概览 + 开始学习 + 自定义导入
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BookOpen, Check, Flame, Import, Loader2, Play } from 'lucide-react';
import { BOOK_META, type VocabBook } from '@/lib/vocab-validations';

type BookSummary = { book: VocabBook; total: number; learned: number; due: number };

export function VocabClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState<BookSummary[]>([]);
  const [current, setCurrent] = useState<VocabBook | null>(null);
  const [stats, setStats] = useState<{ learned: number; due: number; streak: number; dailyNew: number } | null>(null);
  const [switching, setSwitching] = useState<VocabBook | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/vocab/books');
    if (r.status === 401) { router.push('/signin'); return; }
    const j = await r.json().catch(() => ({ data: null }));
    setBooks(j.data?.books ?? []);
    setCurrent(j.data?.current ?? null);
    const s = await fetch('/api/vocab/stats');
    const sj = await s.json().catch(() => ({ data: null }));
    setStats(sj.data);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function selectBook(book: VocabBook) {
    setSwitching(book);
    const r = await fetch('/api/vocab/book', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book }),
    });
    setSwitching(null);
    if (!r.ok) { toast.error('切换失败'); return; }
    setCurrent(book);
    toast.success(`已选择《${BOOK_META[book].label}》`);
    load();
  }

  async function doImport() {
    if (importing || !importText.trim()) return;
    setImporting(true);
    try {
      const r = await fetch('/api/vocab/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || '导入失败'); return; }
      toast.success(`解析 ${j.data.parsed} 条, 导入 ${j.data.imported} 个新词`);
      setImportText('');
      setShowImport(false);
      load();
    } finally {
      setImporting(false);
    }
  }

  const currentBook = books.find((b) => b.book === current);

  return (
    <div className="flex flex-col gap-8">
      {/* 今日概览 */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { icon: <Flame className="h-4 w-4" />, label: '连续打卡', value: stats ? `${stats.streak} 天` : '…' },
          { icon: <BookOpen className="h-4 w-4" />, label: '已学词汇', value: stats ? String(stats.learned) : '…' },
          { icon: <Play className="h-4 w-4" />, label: '今日待学', value: stats ? String(stats.due) : '…' },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-4 text-center">
            <div className="mx-auto mb-1.5 inline-flex text-accent">{s.icon}</div>
            <div className="text-xl font-bold text-text">{s.value}</div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      {/* 开始学习 */}
      {current && (
        <Link
          href="/vocab/study"
          className="glass-card group flex items-center justify-between rounded-2xl px-6 py-5 transition-all hover:-translate-y-0.5 hover:border-accent/50"
        >
          <div>
            <div className="text-base font-semibold text-text">
              开始学习 · {BOOK_META[current].label}
            </div>
            <div className="mt-0.5 text-xs text-text-muted">
              {currentBook ? `已学 ${currentBook.learned} / ${currentBook.total} 词` : ''} · 每日新词 {stats?.dailyNew ?? 10} 个
            </div>
          </div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-amber-400 text-white shadow-lg shadow-accent/25 transition-transform group-hover:scale-110">
            <Play className="h-5 w-5" />
          </span>
        </Link>
      )}

      {/* 词书选择 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
          <span className="h-3.5 w-1 rounded-full bg-accent" />
          选择词书
        </h2>
        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {books.map((b) => {
              const meta = BOOK_META[b.book];
              const active = current === b.book;
              const pct = b.total ? Math.round((b.learned / b.total) * 100) : 0;
              return (
                <button
                  key={b.book}
                  onClick={() => selectBook(b.book)}
                  disabled={switching !== null}
                  className={`glass-card relative rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60 ${
                    active ? 'border-accent/60 ring-1 ring-accent/40' : 'hover:border-accent/40'
                  }`}
                >
                  {active && (
                    <span className="absolute right-4 top-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="text-sm font-semibold text-text">{meta.label}</div>
                  <div className="mt-0.5 text-xs text-text-muted">
                    {meta.desc} · {b.total} 词
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-text-faint">{pct}%</span>
                  </div>
                  {b.due > 0 && (
                    <div className="mt-2 text-[11px] font-medium text-accent">{b.due} 个待复习</div>
                  )}
                  {switching === b.book && <Loader2 className="absolute right-4 top-4 h-5 w-5 animate-spin text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 自定义导入 */}
      <section>
        <button
          onClick={() => setShowImport((s) => !s)}
          className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-accent"
        >
          <Import className="h-4 w-4" />
          导入自定义单词
        </button>
        {showImport && (
          <div className="glass-card mt-3 rounded-2xl p-5">
            <p className="mb-2 text-xs text-text-muted">
              每行一条, 格式: <code className="rounded bg-black/10 px-1 dark:bg-white/10">单词 释义</code> (空格或 Tab 分隔)
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              rows={6}
              placeholder={'serendipity 美妙事物的偶然发现\nephemeral 转瞬即逝的'}
              className="w-full resize-y rounded-lg border border-border/30 bg-bg px-3 py-2 font-mono text-sm text-text outline-none focus:border-accent"
            />
            <button
              onClick={doImport}
              disabled={importing || !importText.trim()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              导入
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
