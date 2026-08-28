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
