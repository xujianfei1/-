'use client';

/**
 * 背单词学习流: 新词卡 → 选择/拼写交替出题 → 结算
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Check, Ear, Loader2, Volume2, X } from 'lucide-react';
import { judgeSpell } from '@/lib/srs';
import { BOOK_META, type VocabBook } from '@/lib/vocab-validations';

type Item = {
  wordId: string;
  word: string;
  phonetic: string | null;
  definition: string;
  example: string | null;
  exampleTrans: string | null;
  isNew: boolean;
  choices: { id: string; word: string; definition: string }[];
};

type Phase = 'loading' | 'learn' | 'choice' | 'spell' | 'done';

export function VocabStudy() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [book, setBook] = useState<VocabBook | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [spellInput, setSpellInput] = useState('');
  const [spellState, setSpellState] = useState<{ verdict: string; answer: string } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const spellRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/vocab/session?size=10');
    if (r.status === 401) { router.push('/signin'); return; }
    const j = await r.json().catch(() => ({ data: null }));
    if (!r.ok) {
      toast.error(j.error || '加载失败');
      if (r.status === 400) router.push('/vocab');
      return;
    }
    setBook(j.data.book);
    setItems(j.data.items);
    setIdx(0);
    setCorrectCount(0);
    // 队列里有新词先学新词, 否则直接进入测验
    const firstNew = j.data.items.findIndex((it: Item) => it.isNew);
    setPhase(firstNew === 0 ? 'learn' : j.data.items.length ? 'choice' : 'done');
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const item = items[idx];

  const speak = useCallback((text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch { /* TTS 不可用则忽略 */ }
  }, []);

  // 新词卡自动发音
  useEffect(() => {
    if (phase === 'learn' && item) speak(item.word);
  }, [phase, idx, item, speak]);

  async function submitAnswer(correct: boolean, nearMiss?: boolean) {
    if (submitting || !item) return;
    setSubmitting(true);
    try {
      const mode = phase === 'spell' ? 'spell' : 'choice';
      const r = await fetch('/api/vocab/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordId: item.wordId, mode, correct, nearMiss }),
      });
      if (!r.ok) toast.error('记录失败, 但已继续');
      if (correct) setCorrectCount((c) => c + 1);
      next();
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    setPicked(null);
    setSpellInput('');
    setSpellState(null);
    if (idx + 1 >= items.length) {
      setPhase('done');
      return;
    }
    const nextItem = items[idx + 1]!;
    setIdx(idx + 1);
    setPhase(nextItem.isNew ? 'learn' : Math.random() < 0.5 ? 'choice' : 'spell');
  }

  function onSpellSubmit() {
    if (!item || spellState) return;
    const { verdict } = judgeSpell(spellInput, item.word);
    setSpellState({ verdict, answer: item.word });
    speak(item.word);
    submitAnswer(verdict === 'correct', verdict === 'near');
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        正在生成今日队列…
      </div>
    );
  }

  if (phase === 'done' || items.length === 0) {
    return (
      <div className="glass-card mx-auto max-w-md rounded-3xl p-10 text-center">
        <span className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-amber-400 text-white shadow-lg shadow-accent/25">
          <Check className="h-7 w-7" />
        </span>
        <h2 className="text-xl font-bold text-text">今日完成!</h2>
        <p className="mt-2 text-sm text-text-muted">
          {book ? BOOK_META[book].label : ''} · 答对 {correctCount} / {items.length || 0}
        </p>
        <p className="mt-1 text-xs text-text-faint">明天记得回来复习哦</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={() => { setPhase('loading'); load(); }}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            再来一组
          </button>
          <Link
            href="/vocab"
            className="rounded-xl border border-border/40 px-5 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
          >
            返回
          </Link>
        </div>
      </div>
    );
  }

  const pct = Math.round((idx / items.length) * 100);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <Link href="/vocab" className="text-text-muted transition-colors hover:text-accent">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-accent to-amber-400 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-text-faint">{idx + 1}/{items.length}</span>
      </div>

      {/* 新词学习卡 */}
      {phase === 'learn' && item && (
        <div className="glass-card rounded-3xl p-8 text-center animate-fade-up">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
            <Ear className="h-3 w-3" />
            新词
          </div>
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-bold text-text">{item.word}</h2>
            <button onClick={() => speak(item.word)} className="text-text-muted transition-colors hover:text-accent" aria-label="发音">
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
          {item.phonetic && <p className="mt-1 font-mono text-sm text-text-faint">/{item.phonetic}/</p>}
          <p className="mt-4 whitespace-pre-line text-base text-text">{item.definition}</p>
          {item.example && (
            <div className="mt-5 border-t border-black/5 pt-4 dark:border-white/10">
              <p className="text-sm italic text-text-muted">{item.example}</p>
              {item.exampleTrans && <p className="mt-1 text-xs text-text-faint">{item.exampleTrans}</p>}
            </div>
          )}
          <button
            onClick={next}
            className="mt-6 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            我记住了, 继续
          </button>
        </div>
      )}

      {/* 四选一 */}
      {phase === 'choice' && item && (
        <div className="glass-card rounded-3xl p-8 animate-fade-up">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-bold text-text">{item.word}</h2>
            <button onClick={() => speak(item.word)} className="text-text-muted transition-colors hover:text-accent" aria-label="发音">
              <Volume2 className="h-5 w-5" />
            </button>
          </div>
          {item.phonetic && <p className="mt-1 text-center font-mono text-sm text-text-faint">/{item.phonetic}/</p>}
          <p className="mt-1 text-center text-xs text-text-faint">选出正确的释义</p>
          <div className="mt-5 flex flex-col gap-2.5">
            {item.choices.map((c) => {
              const isRight = c.id === item.wordId;
              const isPicked = picked === c.id;
              const reveal = picked !== null;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (picked !== null || submitting) return;
                    setPicked(c.id);
                    submitAnswer(isRight);
                  }}
                  disabled={reveal || submitting}
                  className={`rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                    reveal && isRight
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : isPicked
                        ? 'border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        : reveal
                          ? 'border-border/20 text-text-faint'
                          : 'border-border/30 bg-bg text-text hover:border-accent/50'
                  }`}
                >
                  <span className="whitespace-pre-line">{c.definition}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 拼写 */}
      {phase === 'spell' && item && (
        <div className="glass-card rounded-3xl p-8 animate-fade-up">
          <p className="text-center text-xs text-text-faint">根据释义拼写单词</p>
          <p className="mt-3 whitespace-pre-line text-center text-base text-text">{item.definition}</p>
          {item.example && item.exampleTrans && (
            <p className="mt-3 text-center text-xs text-text-faint">{item.exampleTrans}</p>
          )}
          <input
            ref={spellRef}
            value={spellInput}
            onChange={(e) => setSpellInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSpellSubmit(); }}
            placeholder="输入英文单词…"
            autoFocus
            disabled={!!spellState}
            className={`mt-5 w-full rounded-xl border bg-bg px-4 py-3 text-center text-lg font-medium text-text outline-none transition-colors ${
              spellState
                ? spellState.verdict === 'correct'
                  ? 'border-emerald-500/60'
                  : spellState.verdict === 'near'
                    ? 'border-amber-500/60'
                    : 'border-rose-500/60'
                : 'border-border/30 focus:border-accent'
            }`}
          />
          {spellState && (
            <div className={`mt-3 flex items-center justify-center gap-1.5 text-sm ${
              spellState.verdict === 'correct' ? 'text-emerald-600 dark:text-emerald-400'
                : spellState.verdict === 'near' ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}>
              {spellState.verdict === 'correct' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {spellState.verdict === 'correct' && '完全正确!'}
              {spellState.verdict === 'near' && <>接近! 正确拼写: <b>{spellState.answer}</b></>}
              {spellState.verdict === 'wrong' && <>正确答案: <b>{spellState.answer}</b></>}
              <button onClick={() => speak(spellState.answer)} aria-label="发音"><Volume2 className="h-4 w-4" /></button>
            </div>
          )}
          {!spellState ? (
            <button
              onClick={onSpellSubmit}
              disabled={!spellInput.trim() || submitting}
              className="mt-5 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              提交
            </button>
          ) : (
            <button
              onClick={next}
              className="mt-5 w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              继续
            </button>
          )}
        </div>
      )}
    </div>
  );
}
