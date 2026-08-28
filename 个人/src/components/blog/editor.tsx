'use client';

/**
 * 博客编辑器 (client)
 * 左: 全量文章列表 (含草稿) · 右: Markdown 编辑/预览 + 保存/发布/删除
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, FilePlus2, Loader2, Pencil, Save, Trash2 } from 'lucide-react';
import { Markdown } from '@/components/blog/markdown';
import { slugify } from '@/lib/blog-validations';
import { formatDateTime } from '@/lib/utils';
import type { Post } from '@/types';

type Form = {
  title: string;
  slug: string;
  summary: string;
  tags: string;
  content: string;
  status: 'draft' | 'published';
};

const EMPTY_FORM: Form = { title: '', slug: '', summary: '', tags: '', content: '', status: 'draft' };

export function BlogEditor() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [editingSlug, setEditingSlug] = useState<string | null>(null); // null = 新建
  const slugTouched = useRef(false);

  const load = useCallback(async () => {
    const r = await fetch('/api/blog?all=1');
    if (r.status === 401) {
      router.push('/signin');
      return;
    }
    const j = await r.json().catch(() => ({ data: [] }));
    setPosts(j.data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function startNew() {
    setEditingSlug(null);
    slugTouched.current = false;
    setForm(EMPTY_FORM);
    setMode('edit');
  }

  function startEdit(p: Post) {
    setEditingSlug(p.slug);
    slugTouched.current = true; // 编辑已有文章时不再自动改 slug
    setForm({
      title: p.title,
      slug: p.slug,
      summary: p.summary ?? '',
      tags: p.tags ?? '',
      content: p.content,
      status: p.status === 'published' ? 'published' : 'draft',
    });
    setMode('edit');
  }

  function onTitleChange(title: string) {
    setForm((f) => {
      if (editingSlug || slugTouched.current) return { ...f, title };
      // slug 跟随标题; 纯中文等 slugify 为空时用随机串兜底
      const s = slugify(title);
      return { ...f, title, slug: s || `post-${Date.now().toString(36)}` };
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const body = {
        title: form.title,
        slug: form.slug,
        summary: form.summary || null,
        tags: form.tags || null,
        content: form.content,
        status: form.status,
      };
      const r = await fetch(editingSlug ? `/api/blog/${editingSlug}` : '/api/blog', {
        method: editingSlug ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j.error || '保存失败');
        return;
      }
      toast.success(form.status === 'published' ? '已发布' : '草稿已保存');
      setEditingSlug(j.data.slug);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Post) {
    if (!window.confirm(`确定删除《${p.title}》? 此操作不可恢复。`)) return;
    const r = await fetch(`/api/blog/${p.slug}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) {
      toast.error('删除失败');
      return;
    }
    toast.success('已删除');
    if (editingSlug === p.slug) startNew();
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">写文章</h1>
          <p className="mt-1 text-sm text-text-muted">共 {posts.length} 篇 (含草稿)</p>
        </div>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 左: 文章列表 */}
        <aside className="w-full shrink-0 lg:w-72">
          <button
            onClick={startNew}
            className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/30 bg-surface px-3 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-accent"
          >
            <FilePlus2 className="h-4 w-4" />
            新建文章
          </button>
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto lg:max-h-[70vh]">
            {loading && (
              <li className="flex items-center gap-2 p-3 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中…
              </li>
            )}
            {posts.map((p) => (
              <li key={p.id} className="group relative">
                <button
                  onClick={() => startEdit(p)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    editingSlug === p.slug
                      ? 'border-accent/60 bg-accent/5'
                      : 'border-border/30 bg-surface hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        p.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="truncate text-sm font-medium text-text">{p.title}</span>
                  </div>
                  <div className="mt-1 pl-3.5 text-xs text-text-faint">
                    /{p.slug} · {formatDateTime(p.updatedAt)}
                  </div>
                </button>
                <button
                  onClick={() => remove(p)}
                  title="删除"
                  className="absolute right-2 top-2 rounded p-1 text-text-faint opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* 右: 编辑区 */}
        <section className="min-w-0 flex-1 rounded-xl border border-border/30 bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-border/30 p-0.5">
              <button
                onClick={() => setMode('edit')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm ${
                  mode === 'edit' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                onClick={() => setMode('preview')}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm ${
                  mode === 'preview' ? 'bg-accent text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                预览
              </button>
            </div>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Form['status'] }))}
              className="rounded-lg border border-border/30 bg-bg px-2.5 py-1.5 text-sm text-text"
            >
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
            <button
              onClick={save}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              保存
            </button>
          </div>

          {mode === 'preview' ? (
            <div className="min-h-[50vh] rounded-lg border border-border/20 p-4">
              {form.content ? (
                <Markdown content={form.content} />
              ) : (
                <p className="text-sm text-text-muted">暂无正文, 去「编辑」页写点什么吧。</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <input
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="文章标题"
                maxLength={120}
                className="w-full rounded-lg border border-border/30 bg-bg px-3 py-2 text-base font-medium text-text outline-none focus:border-accent"
              />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  slug
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      slugTouched.current = true;
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                    }}
                    placeholder="url-标识 (小写字母数字连字符)"
                    className="min-w-0 flex-1 rounded-lg border border-border/30 bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-accent"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  标签
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="逗号分隔, 如: next.js,部署"
                    className="min-w-0 flex-1 rounded-lg border border-border/30 bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
                  />
                </label>
              </div>
              <input
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="摘要 (可选, 列表页展示; 留空则显示「点击阅读全文」)"
                maxLength={200}
                className="w-full rounded-lg border border-border/30 bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder="正文 (Markdown)…"
                rows={18}
                className="w-full resize-y rounded-lg border border-border/30 bg-bg px-3 py-2 font-mono text-sm leading-relaxed text-text outline-none focus:border-accent"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
