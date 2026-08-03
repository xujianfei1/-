/**
 * Link 业务层 (Server-only)
 */
import { prisma } from '@/lib/prisma';
import type { LinkCreate, LinkUpdate } from '@/lib/validations';

export async function getLinks() {
  return prisma.link.findMany({
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getLinkById(id: string) {
  return prisma.link.findUnique({ where: { id } });
}

export async function createLink(data: LinkCreate) {
  return prisma.link.create({ data });
}

export async function updateLink(id: string, data: LinkUpdate) {
  return prisma.link.update({ where: { id }, data });
}

export async function deleteLink(id: string) {
  return prisma.link.delete({ where: { id } });
}
