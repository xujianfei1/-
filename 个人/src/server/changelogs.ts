/**
 * Changelog 业务层 (Server-only)
 */
import { prisma } from '@/lib/prisma';
import type { ChangelogCreate } from '@/lib/changelog-validations';

export async function getChangelogs(limit = 50) {
  return prisma.changelog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function createChangelog(data: ChangelogCreate) {
  return prisma.changelog.create({ data });
}

export async function deleteChangelog(id: string) {
  return prisma.changelog.delete({ where: { id } });
}
