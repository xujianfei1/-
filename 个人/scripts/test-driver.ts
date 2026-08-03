// 测实际的 OssDriver 类 (走 tsx 跑 ts)
// 用法: pnpm tsx scripts/test-driver.ts
import { OssDriver } from '../src/lib/storage/oss';

async function main() {
  const driver = new OssDriver();
  const testKey = `_test/driver-${Date.now()}.bin`;
  const partKey1 = `${testKey}.p1`;
  const partKey2 = `${testKey}.p2`;
  const concatKey = `${testKey}.concat`;

  // 准备数据: 用 200KB x 2 满足 OSS multipart 最小 part 要求
  const buf1 = Buffer.alloc(200 * 1024, 0x41); // 200KB of 'A'
  const buf2 = Buffer.alloc(150 * 1024, 0x42); // 150KB of 'B'

  console.log('[1/8] put part1 (200KB)...');
  await driver.put(partKey1, buf1);
  const sz1 = await driver.size(partKey1);
  console.log(`  size1=${sz1} (expected ${buf1.length})`);
  if (sz1 !== buf1.length) throw new Error('part1 size mismatch');

  console.log('[2/8] put part2 (150KB)...');
  await driver.put(partKey2, buf2);
  const sz2 = await driver.size(partKey2);
  console.log(`  size2=${sz2} (expected ${buf2.length})`);
  if (sz2 !== buf2.length) throw new Error('part2 size mismatch');

  console.log('[3/8] exists...');
  if (!(await driver.exists(partKey1))) throw new Error('part1 should exist');
  if (!(await driver.exists(partKey2))) throw new Error('part2 should exist');
  if (await driver.exists(testKey + '.nonexistent')) throw new Error('nonexistent should not exist');
  console.log('  ok');

  console.log('[4/8] get (stream)...');
  const stream = await driver.get(partKey1);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const got = Buffer.concat(chunks);
  if (got.length !== buf1.length || !got.equals(buf1)) {
    throw new Error(`get mismatch: got ${got.length} bytes, expected ${buf1.length}`);
  }
  console.log(`  got ${got.length} bytes, matches`);

  console.log('[5/8] concat 2 parts → concatKey (multipart + UploadPartCopy)...');
  await driver.concat([partKey1, partKey2], concatKey);
  const sz = await driver.size(concatKey);
  console.log(`  concat size=${sz} (expected ${buf1.length + buf2.length})`);
  if (sz !== buf1.length + buf2.length) throw new Error('concat size mismatch');

  console.log('[6/8] verify concat content (first byte A, then B after 200KB)...');
  const cstream = await driver.get(concatKey);
  const cchunks: Buffer[] = [];
  for await (const c of cstream) cchunks.push(c as Buffer);
  const cgot = Buffer.concat(cchunks);
  if (cgot.length !== sz) throw new Error('concat read size mismatch');
  if (cgot[0] !== 0x41) throw new Error('first byte should be A');
  if (cgot[buf1.length] !== 0x42) throw new Error('byte at 200KB should be B');
  console.log('  ok (first byte A, transition at 200KB to B)');

  console.log('[7/8] size of nonexistent → 0');
  const nz = await driver.size(testKey + '.nonexistent');
  if (nz !== 0) throw new Error(`nonexistent size should be 0, got ${nz}`);
  console.log('  ok');

  console.log('[8/8] delete all...');
  await driver.delete(partKey1);
  await driver.delete(partKey2);
  await driver.delete(concatKey);
  console.log('  ok');

  console.log('OK - OssDriver all methods working');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
