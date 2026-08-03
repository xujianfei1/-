import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const result = await p.service.updateMany({
  where: { name: '经期预测' },
  data: { url: 'https://period.xujianfei.cn' },
});
console.log(`Updated ${result.count} row(s)`);

const after = await p.service.findFirst({ where: { name: '经期预测' } });
console.log('After:', JSON.stringify({ name: after?.name, url: after?.url }));

await p.$disconnect();
