/**
 * 业务类型定义
 * 与 Prisma 模型对应, 但便于前后端共享
 */
import type { ServiceStatus } from '@/lib/validations';
import type { PostStatus } from '@/lib/blog-validations';

export interface Post {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  tags: string | null;
  status: PostStatus;
  views: number;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** 列表页用的文章裁剪版 (无正文) */
export type PostListItem = Omit<Post, 'content'>;

export interface Service {
  id: string;
  name: string;
  description: string;
  url: string | null;
  icon: string;
  status: ServiceStatus;
  category: string | null;
  sortOrder: number;
  isPublic: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Link {
  id: string;
  name: string;
  url: string;
  icon: string;
  sortOrder: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
