'use client';

import * as React from 'react';
import { Paperclip, Send } from 'lucide-react';
import { isValidUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function SearchBox() {
  const [query, setQuery] = React.useState('');
  const [matchCount, setMatchCount] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // 自动伸缩
  React.useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [query]);

  // 实时过滤服务卡片
  React.useEffect(() => {
    const q = query.trim().toLowerCase();
    const cards = document.querySelectorAll<HTMLElement>('[data-service-search]');
    if (!q) {
      cards.forEach((c) => (c.style.display = ''));
      setMatchCount(null);
      return;
    }
    let visible = 0;
    cards.forEach((card) => {
      const text = (card.dataset.serviceSearch || '').toLowerCase();
      const match = text.includes(q);
      card.style.display = match ? '' : 'none';
      if (match) visible++;
    });
    setMatchCount(visible);
  }, [query]);

  function handleSubmit(value: string) {
    const v = value.trim();
    if (!v) return;
    if (/^https?:\/\//i.test(v)) {
      window.open(v, '_blank');
    } else if (isValidUrl(v)) {
      window.open('https://' + v, '_blank');
    } else {
      window.open('https://cn.bing.com/search?q=' + encodeURIComponent(v), '_blank');
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(query);
    }
  }

  return (
    <section className="animate-fade-up [animation-delay:200ms] [animation-fill-mode:both]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit(query);
        }}
        className="group relative rounded-[28px] border border-border bg-surface p-4 shadow-sm transition-all focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--accent-soft),0_4px_16px_rgba(31,30,28,0.06)]"
      >
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索服务、输入网址,或问点什么..."
          rows={1}
          spellCheck={false}
          className="w-full resize-none border-0 bg-transparent text-sm leading-relaxed text-text placeholder:text-text-faint focus:outline-none px-1 py-1.5 min-h-[28px] max-h-[200px]"
        />
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <Button type="button" variant="ghost" size="icon" aria-label="附件">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" aria-label="发送">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
      <p
        className={`mt-3 text-center text-xs transition-colors ${
          matchCount !== null ? 'text-accent' : 'text-text-faint'
        }`}
      >
        {matchCount !== null
          ? `匹配到 ${matchCount} 个服务`
          : '提示: 输入服务名过滤卡片 · 输入网址回车直达'}
      </p>
    </section>
  );
}
