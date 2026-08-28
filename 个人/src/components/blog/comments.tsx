'use client';

/**
 * 博客评论区 (client)
 * 登录用户可评论; 本人或 admin 可删自己的评论
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { BlogComment } from '@/types';

type Props = {
  slug: string;
  /** 未登录为 null */
  currentUser: { id: string; name: string; isAdmin: boolean } | null;
};

export function Comments({ slug, currentUser }: Props) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/blog/${slug}/comments`);
    const j = await r.json().catch(() => ({ data: [] }));
    setComments(j.data ?? []);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (submitting || !body.trim()) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/blog/${slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || '评论失败');
        return;
      }
      setComments((c) => [...c, j.data]);
      setBody('');
      toast.success('评论已发布');
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm('确定删除这条评论?')) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/blog/comments/${id}`, { method: 'DELETE' });
      if (!r.ok && r.status !== 204) {
        toast.error('删除失败');
        return;
      }
      setComments((c) => c.filter((x) => x.id !== id));
      toast.success('已删除');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-border/30 bg-surface p-5 md:p-6">
      <h2 className="text-base font-semibold text-text">评论 ({comments.length})</h2>

      {/* 发表框 */}
      <div className="mt-4">
        {currentUser ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`以 ${currentUser.name} 的身份评论…`}
              rows={3}
              maxLength={1000}
              className="w-full resize-y rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-faint">{body.length}/1000</span>
              <button
                onClick={submit}
                disabled={submitting || !body.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                发表评论
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-border/20 bg-bg px-4 py-3 text-sm text-text-muted">
            <Link href="/signin" className="text-accent hover:underline">
              登录
            </Link>
            后即可参与评论。
          </p>
        )}
      </div>

      {/* 评论列表 */}
      <ul className="mt-5 flex flex-col gap-4">
        {loading && (
          <li className="flex items-center gap-2 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载评论…
          </li>
        )}
        {!loading && comments.length === 0 && (
          <li className="text-sm text-text-muted">还没有评论, 来抢沙发。</li>
        )}
        {comments.map((c) => {
          const canDelete = currentUser && (currentUser.isAdmin || currentUser.id === c.userId);
          return (
            <li key={c.id} className="border-b border-border/20 pb-4 last:border-none">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent">
                    {(c.user.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="text-sm font-medium text-text">{c.user.name || '匿名用户'}</span>
                  <span className="text-xs text-text-faint">{formatDateTime(c.createdAt)}</span>
                </div>
                {canDelete && (
                  <button
                    onClick={() => remove(c.id)}
                    disabled={deletingId === c.id}
                    title="删除评论"
                    className="rounded p-1 text-text-faint transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-wrap pl-8 text-sm leading-relaxed text-text">{c.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
