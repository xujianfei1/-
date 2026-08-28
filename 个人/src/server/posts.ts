/**
 * Post 业务层 (Server-only)
 * API 路由与 RSC 页面通过这些函数读写文章
 */
import { prisma } from '@/lib/prisma';
import type { Post } from '@/types';
import type { PostCreate, PostUpdate } from '@/lib/blog-validations';

// status 在写入侧由 zod 约束为枚举, DB 读出的 string 此处收窄
export async function getPublishedPosts() {
  return prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      tags: true,
      status: true,
      views: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<Omit<Post, 'content'>[]>;
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findUnique({ where: { slug } }) as Promise<Post | null>;
}

/** 后台编辑器全量列表 (含草稿, 含正文) */
export async function getAllPosts() {
  return prisma.post.findMany({
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  }) as Promise<Post[]>;
}

export async function createPost(data: PostCreate) {
  return prisma.post.create({
    data: {
      ...data,
      summary: data.summary ?? null,
      tags: data.tags ?? null,
      publishedAt: data.status === 'published' ? new Date() : null,
    },
  }) as Promise<Post>;
}

export async function updatePost(id: string, data: PostUpdate) {
  const existing = await prisma.post.findUnique({
    where: { id },
    select: { status: true, publishedAt: true },
  });
  if (!existing) return null;

  const nextStatus = data.status ?? existing.status;
  // 首次发布补时间; 已发布文章保留原发布时间 (反复改稿不影响排序)
  const publishedAt =
    nextStatus === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt;

  return prisma.post.update({
    where: { id },
    data: { ...data, publishedAt },
  }) as Promise<Post | null>;
}

export async function deletePost(id: string) {
  return prisma.post.delete({ where: { id } });
}

export async function incrementViews(slug: string) {
  return prisma.post.update({
    where: { slug },
    data: { views: { increment: 1 } },
    select: { views: true },
  });
}

// ============================================================
// 站内搜索 (v2)
// ============================================================

/** 已发布文章搜索: 标题/摘要/标签/正文 任一命中 (不返回正文) */
export async function searchPublishedPosts(q: string) {
  const kw = q.trim();
  return prisma.post.findMany({
    where: {
      status: 'published',
      OR: [
        { title: { contains: kw } },
        { summary: { contains: kw } },
        { tags: { contains: kw } },
        { content: { contains: kw } },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      tags: true,
      status: true,
      views: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<Omit<Post, 'content'>[]>;
}

// ============================================================
// 评论 (v2)
// ============================================================

/** 某篇文章的评论列表 (带评论者昵称, 按时间正序) */
export async function getComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      body: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
}

export async function addComment(postId: string, userId: string, body: string) {
  return prisma.comment.create({
    data: { postId, userId, body },
    select: {
      id: true,
      body: true,
      createdAt: true,
      userId: true,
      user: { select: { name: true } },
    },
  });
}

export async function getCommentById(id: string) {
  return prisma.comment.findUnique({ where: { id }, select: { id: true, userId: true, postId: true } });
}

export async function deleteComment(id: string) {
  return prisma.comment.delete({ where: { id } });
}
