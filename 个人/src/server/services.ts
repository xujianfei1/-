/**
 * Service 业务层 (Server-only)
 * 这里集中所有 Service 相关的 DB 操作, API 路由通过这些函数读写数据
 */
import { prisma } from '@/lib/prisma';
import type { ServiceCreate, ServiceUpdate } from '@/lib/validations';

export async function getServices() {
  return prisma.service.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getOnlineServices() {
  return prisma.service.findMany({
    where: { status: 'online', isPublic: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getServiceById(id: string) {
  return prisma.service.findUnique({ where: { id } });
}

export async function createService(data: ServiceCreate) {
  return prisma.service.create({ data });
}

export async function updateService(id: string, data: ServiceUpdate) {
  return prisma.service.update({ where: { id }, data });
}

export async function deleteService(id: string) {
  return prisma.service.delete({ where: { id } });
}
