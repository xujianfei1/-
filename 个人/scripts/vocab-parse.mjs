/**
 * 词库解析: KyleBing/english-vocabulary jsonl → prisma/vocab-data/*.json
 * 运行: node scripts/vocab-parse.mjs
 * 输入: $TEMP/vocab-src/{四级,六级,考研}.jsonl
 * 输出: prisma/vocab-data/words.json  [{word, phonetic, definition, example, exampleTrans, book:"CET4,CET6"}]
 * 规则: 同词跨书合并 book 标签; definition 合并多条翻译; example 取第一句
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const SRC = path.join(os.tmpdir(), 'vocab-src');
const OUT = path.join(process.cwd(), 'prisma', 'vocab-data');
fs.mkdirSync(OUT, { recursive: true });

const BOOKS = [
  { file: '四级.jsonl', code: 'CET4', prio: 1 },
  { file: '六级.jsonl', code: 'CET6', prio: 2 },
  { file: '考研.jsonl', code: 'KAOYAN', prio: 3 },
];

const byWord = new Map();

for (const { file, code } of BOOKS) {
  const raw = fs.readFileSync(path.join(SRC, file), 'utf8');
  let n = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try { j = JSON.parse(line); } catch { continue; }
    if (!j.word || !Array.isArray(j.translations) || j.translations.length === 0) continue;

    const word = j.word.trim().toLowerCase();
    if (!/^[a-zA-Z][a-zA-Z'-]{0,40}$/.test(word)) continue;

    const definition = j.translations
      .map((t) => (t.type ? `${t.type}. ${t.translation}` : t.translation))
      .join('\n')
      .slice(0, 500);

    const ex = Array.isArray(j.sentences) && j.sentences[0] ? j.sentences[0] : null;

    if (!byWord.has(word)) {
      byWord.set(word, {
        word,
        phonetic: (j.us || j.uk || '').replace(/'/g, 'ˈ').slice(0, 60),
        definition,
        example: ex ? ex.sentence.slice(0, 300) : null,
        exampleTrans: ex ? ex.translation.slice(0, 300) : null,
        book: new Set([code]),
      });
    } else {
      byWord.get(word).book.add(code);
    }
    n++;
  }
  console.log(file, '解析', n, '行');
}

const words = [...byWord.values()].map((w) => ({ ...w, book: [...w.book].join(',') }));
words.sort((a, b) => a.word.localeCompare(b.word));

fs.writeFileSync(path.join(OUT, 'words.json'), JSON.stringify(words));
const stat = {};
for (const code of ['CET4', 'CET6', 'KAOYAN']) {
  stat[code] = words.filter((w) => w.book.includes(code)).length;
}
console.log('合计唯一词:', words.length, '| 各书覆盖:', JSON.stringify(stat));
