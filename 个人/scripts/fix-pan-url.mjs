/**
 * 一键把首页"私有云盘"卡片 url 改成 https://pan.xujianfei.cn, status 改 online.
 * 跟 scripts/fix-period-url.mjs 同模式.
 *
 * 用法: node scripts/fix-pan-url.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.service.updateMany({
    where: { name: '私有云盘' },
    data: { url: 'https://pan.xujianfei.cn', status: 'online' },
  });
  console.log(`✅ Updated ${result.count} service(s) to pan.xujianfei.cn / online`);
}

main()
  .catch((e) => {
    console.error('❌ Update failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
