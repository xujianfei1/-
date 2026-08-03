import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const svc = await p.service.findFirst({ where: { name: '经期预测' } });
console.log(JSON.stringify(svc, null, 2));
await p.$disconnect();
