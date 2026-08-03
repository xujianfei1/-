// 一次性脚本: 授权 2603948597@qq.com 为 admin
import { prisma } from '../src/lib/prisma';

async function main() {
  const target = '2603948597@qq.com';
  const u = await prisma.user.findUnique({ where: { email: target } });
  if (!u) {
    console.error(`用户 ${target} 不存在`);
    process.exit(1);
  }
  console.log(`找到: id=${u.id} name="${u.name}" isAdmin=${u.isAdmin} banned=${u.banned}`);
  if (u.isAdmin) {
    console.log('已经是 admin, 无需操作');
    return;
  }
  await prisma.user.update({
    where: { id: u.id },
    data: { isAdmin: true },
  });
  console.log(`✓ ${target} 已设为 admin`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });