/**
 * 词库入库: prisma/vocab-data/words.json → Word 表 (幂等, upsert by word)
 * 运行: pnpm tsx scripts/vocab-seed.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const words = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'prisma', 'vocab-data', 'words.json'), 'utf8'));

async function main() {
  console.log('词库入库开始:', words.length, '词');
  let i = 0;
  for (const w of words) {
    await prisma.word.upsert({
      where: { word: w.word },
      create: { word: w.word, phonetic: w.phonetic, definition: w.definition, example: w.example, exampleTrans: w.exampleTrans, book: w.book },
      update: { book: w.book, phonetic: w.phonetic, definition: w.definition, example: w.example, exampleTrans: w.exampleTrans },
    });
    if (++i % 1000 === 0) console.log('...', i);
  }
  const total = await prisma.word.count();
  console.log('完成, Word 表总数:', total);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
