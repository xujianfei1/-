/**
 * 用户业务层
 */
import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import bcrypt from 'bcryptjs';
import type { RegisterInput, UpdateNameInput } from '@/lib/validations';

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });
}

/** 改昵称. 只改 name, 不允许改 email (登录身份). */
export async function updateUserName(userId: string, input: UpdateNameInput) {
  return prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
    select: { id: true, name: true, email: true, updatedAt: true },
  });
}

/**
 * 注销账号: 删用户 + 清理所有相关数据.
 * - 物理文件: 用户的全部 file (私人 + 在共享池创建的) 物理删 (best effort, 失败不致命)
 * - DB: FileShare (owner), UploadSession (owner), File (ownerId) 全删, Session/Account 全删, User 删
 * - File.parent 的 cascade 会自动删子目录行, 不用手动 BFS
 *
 * 顺序: 先删物理文件 (耗时) → 再删 DB 行 (事务).
 */
export async function deleteUserAndData(userId: string): Promise<{ filesDeleted: number }> {
  // 1. 收集这个用户拥有的所有 file (私人 + 共享池里他创建的)
  const userFiles = await prisma.file.findMany({
    where: { ownerId: userId },
    select: { id: true, storageKey: true },
  });
  const fileIds = userFiles.map((f) => f.id);
  const storageKeys = userFiles.map((f) => f.storageKey).filter((k): k is string => !!k);

  // 2. 物理文件 best-effort 删除 (失败不阻塞 DB 删)
  const storage = getStorage();
  await Promise.allSettled(storageKeys.map((k) => storage.delete(k)));

  // 3. DB 事务: 删用户所有相关行
  // 注: FileShare/UploadSession/Session/Account 没有 onDelete: Cascade, 必须手动删
  await prisma.$transaction([
    prisma.fileShare.deleteMany({ where: { ownerId: userId } }),
    prisma.uploadSession.deleteMany({ where: { ownerId: userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.file.deleteMany({ where: { ownerId: userId } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  return { filesDeleted: fileIds.length };
}
