/**
 * 业务类型定义
 * 与 Prisma 模型对应, 但便于前后端共享
 */
import type { ServiceStatus } from '@/lib/validations';

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
