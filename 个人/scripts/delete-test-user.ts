// 一次性脚本: 删测试账号 osstest@xjf.cn
// 走现成 deleteUserAndData, 包含物理文件删除 + DB 级联
//
// 用法 (ECS, 项目根目录):
//   sudo -u www ./node_modules/.bin/tsx scripts/delete-test-user.ts
import { prisma } from '../src/lib/prisma';
import { deleteUserAndData } from '../src/server/users';

const TARGET_EMAIL = 'osstest@xjf.cn';

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    include: {
      _count: {
        select: { files: true, accounts: true, sessions: true },
      },
    },
  });
  if (!u) {
    console.log(`用户 ${TARGET_EMAIL} 不存在, 无事可做`);
    return;
  }
  const shareCount = await prisma.fileShare.count({ where: { ownerId: u.id } });
  console.log(`找到用户: id=${u.id} name="${u.name}"`);
  console.log(`  files: ${u._count.files}`);
  console.log(`  accounts: ${u._count.accounts}`);
  console.log(`  sessions: ${u._count.sessions}`);
  console.log(`  shares: ${shareCount}`);

  if (u._count.files > 0) {
    const total = await prisma.file.aggregate({
      where: { ownerId: u.id },
      _sum: { size: true },
    });
    console.log(`  total file size: ${total._sum.size ?? 0n} bytes`);
  }

  console.log('\n开始删除...');
  const result = await deleteUserAndData(u.id);
  console.log(`  物理文件删除: ${result.filesDeleted}`);

  const after = await prisma.user.findUnique({ where: { id: u.id } });
  if (after) {
    throw new Error('用户还在, 删除失败');
  }
  console.log(`✓ 用户 ${TARGET_EMAIL} 已删除`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
