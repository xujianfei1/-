/**
 * Seed 脚本 - 写入初始数据
 * 运行: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const services = [
  { name: '经期预测', description: '生理周期追踪 · 排卵日推算', url: 'https://period.xujianfei.cn', icon: 'calendar-heart',   status: 'online', sortOrder: 1 },
  { name: '博客',     description: '技术文章和思考分享',       url: '/blog',                        icon: 'pencil',           status: 'online', sortOrder: 2 },
  { name: '私有云盘', description: '私人文件存储和分享',       url: 'https://pan.xujianfei.cn',     icon: 'folder',           status: 'online', sortOrder: 3 },
  { name: '笔记',     description: '知识管理和笔记系统',       url: null,                           icon: 'book-open',        status: 'dev',    sortOrder: 4 },
  { name: '文件分享', description: '临时文件分享服务',         url: null,                           icon: 'upload',           status: 'plan',   sortOrder: 5 },
  { name: '更多',     description: '更多服务正在开发中',       url: null,                           icon: 'plus',             status: 'idea',   sortOrder: 6 },
];

const links = [
  { name: 'GitHub',         url: 'https://github.com',         icon: 'github',  sortOrder: 1 },
  { name: 'ChatGPT',        url: 'https://chat.openai.com',    icon: 'bot',     sortOrder: 2 },
  { name: 'Notion',         url: 'https://notion.so',          icon: 'notebook', sortOrder: 3 },
  { name: 'Stack Overflow', url: 'https://stackoverflow.com',  icon: 'messages-square', sortOrder: 4 },
];

async function main() {
  console.log('🌱 Seeding database...');

  // 清空 (按依赖顺序)
  await prisma.visitLog.deleteMany();
  await prisma.service.deleteMany();
  await prisma.link.deleteMany();

  // 写入服务
  for (const s of services) {
    await prisma.service.create({ data: s });
  }
  console.log(`✅ Seeded ${services.length} services`);

  // 写入链接
  for (const l of links) {
    await prisma.link.create({ data: l });
  }
  console.log(`✅ Seeded ${links.length} links`);

  console.log('🎉 Seed complete');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
