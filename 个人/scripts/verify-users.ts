// 一次性脚本: 验证 osstest 删除
import { prisma } from '../src/lib/prisma';

async function main() {
  const all = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('剩余用户:');
  for (const u of all) console.log(`  ${u.email} (${u.name}) id=${u.id}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});