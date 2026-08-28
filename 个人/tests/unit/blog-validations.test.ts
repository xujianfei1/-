/**
 * 博客校验规则单元测试
 */
import { describe, it, expect } from 'vitest';
import { postCreateSchema, postUpdateSchema, slugify, postSlugSchema } from '@/lib/blog-validations';

const validPost = {
  title: '我的第一篇文章',
  slug: 'my-first-post',
  content: '# Hello\n\n正文内容',
};

describe('postCreateSchema', () => {
  it('合法文章通过, status 默认 draft', () => {
    const r = postCreateSchema.safeParse(validPost);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.status).toBe('draft');
  });

  it('标题为空 / 超长被拒', () => {
    expect(postCreateSchema.safeParse({ ...validPost, title: '' }).success).toBe(false);
    expect(postCreateSchema.safeParse({ ...validPost, title: '字'.repeat(121) }).success).toBe(false);
  });

  it('正文为空被拒', () => {
    expect(postCreateSchema.safeParse({ ...validPost, content: '' }).success).toBe(false);
  });

  it('status 只接受 draft / published', () => {
    expect(postCreateSchema.safeParse({ ...validPost, status: 'published' }).success).toBe(true);
    expect(postCreateSchema.safeParse({ ...validPost, status: 'online' }).success).toBe(false);
  });

  it('summary 超过 200 字被拒', () => {
    expect(postCreateSchema.safeParse({ ...validPost, summary: '字'.repeat(201) }).success).toBe(false);
  });
});

describe('postSlugSchema', () => {
  it.each(['blog', 'my-post', 'post-123', 'a'])('合法 slug: %s', (s) => {
    expect(postSlugSchema.safeParse(s).success).toBe(true);
  });

  it.each(['Blog', 'my_post', '-lead', 'trail-', 'a--b  c', '', '中文', 'a'.repeat(81)])(
    '非法 slug: %s',
    (s) => {
      expect(postSlugSchema.safeParse(s).success).toBe(false);
    },
  );
});

describe('postUpdateSchema', () => {
  it('空对象合法 (partial)', () => {
    expect(postUpdateSchema.safeParse({}).success).toBe(true);
  });

  it('只改 status 合法', () => {
    const r = postUpdateSchema.safeParse({ status: 'published' });
    expect(r.success).toBe(true);
  });

  it('错误类型字段被拒', () => {
    expect(postUpdateSchema.safeParse({ title: 123 }).success).toBe(false);
  });
});

describe('slugify', () => {
  it('英文标题: 小写化 + 空白转连字符', () => {
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('  Deploy Next.js  to ECS ')).toBe('deploy-nextjs-to-ecs');
  });

  it('剔除非法字符', () => {
    expect(slugify('Hello, World! (2026)')).toBe('hello-world-2026');
  });

  it('纯中文标题得到空串 (调用方需兜底)', () => {
    expect(slugify('中文标题测试')).toBe('');
  });

  it('压缩多余连字符并去掉首尾连字符', () => {
    expect(slugify('a--  -b-')).toBe('a-b');
  });

  it('截断到 80 字符', () => {
    expect(slugify('a'.repeat(120)).length).toBe(80);
  });
});
