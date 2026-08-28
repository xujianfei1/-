// 测 OssDriver 的 multipart + presign 4 个新方法 (M3 直传支持)
// 用法: pnpm tsx scripts/test-direct.ts
//
// 流程:
//   1. initMultipartUpload 拿 ossUploadId
//   2. createPresignedPutUrl 拿每 part 的 PUT URL
//   3. 用 fetch 直接 PUT 到 OSS (模拟客户端)
//   4. 抓 ETag
//   5. completeMultipartUpload 拼成最终对象
//   6. 读回来验证内容
//   7. 测 abort (重新 init → abort, 不应残留)
import { OssDriver } from '../src/lib/storage/oss';

const PART_SIZE = 200 * 1024; // 200KB, 满足 OSS multipart 最小 part 要求
const PART_COUNT = 3;
const TOTAL_SIZE = PART_SIZE * PART_COUNT;

async function main() {
  const driver = new OssDriver();
  const testKey = `_test/direct-${Date.now()}.bin`;

  // 准备数据: 3 段, 每段 200KB, 字节值递增
  const parts: Buffer[] = [];
  for (let i = 0; i < PART_COUNT; i++) {
    parts.push(Buffer.alloc(PART_SIZE, 0x41 + i));
  }
  const expected = Buffer.concat(parts);

  console.log('[1/9] initMultipartUpload...');
  const init = await driver.initMultipartUpload(testKey, 'application/octet-stream');
  console.log(`  uploadId=${init.uploadId.slice(0, 20)}..., key=${init.key}`);
  if (!init.uploadId) throw new Error('uploadId empty');

  console.log('[2/9] createPresignedPutUrl x3...');
  const urls: string[] = [];
  for (let i = 0; i < PART_COUNT; i++) {
    const u = await driver.createPresignedPutUrl(testKey, init.uploadId, i + 1, 600);
    urls.push(u);
    console.log(`  part${i + 1} url=${u.slice(0, 80)}...`);
  }
  if (urls.some((u) => !u.startsWith('http'))) throw new Error('presigned url malformed');

  console.log('[3/9] PUT each part to OSS (fetch) + capture ETag...');
  const etags: Array<{ partNumber: number; etag: string }> = [];
  for (let i = 0; i < PART_COUNT; i++) {
    const res = await fetch(urls[i]!, { method: 'PUT', body: new Uint8Array(parts[i]!) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`PUT part ${i + 1} failed: HTTP ${res.status} ${text}`);
    }
    const etag = res.headers.get('ETag') || res.headers.get('etag');
    if (!etag) throw new Error(`part ${i + 1} no ETag in response`);
    console.log(`  part${i + 1} etag=${etag}`);
    etags.push({ partNumber: i + 1, etag });
  }

  console.log('[4/9] completeMultipartUpload...');
  await driver.completeMultipartUpload(testKey, init.uploadId, etags);
  console.log('  ok');

  console.log('[5/9] verify size...');
  const sz = await driver.size(testKey);
  console.log(`  size=${sz} (expected ${TOTAL_SIZE})`);
  if (sz !== TOTAL_SIZE) throw new Error('size mismatch');

  console.log('[6/9] verify content (each 200KB segment has correct byte)...');
  const stream = await driver.get(testKey);
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const got = Buffer.concat(chunks);
  if (got.length !== TOTAL_SIZE) throw new Error(`length mismatch: ${got.length} != ${TOTAL_SIZE}`);
  for (let i = 0; i < PART_COUNT; i++) {
    const sample = got[i * PART_SIZE]!;
    if (sample !== 0x41 + i) {
      throw new Error(`segment ${i} first byte = 0x${sample.toString(16)}, expected 0x${(0x41 + i).toString(16)}`);
    }
  }
  if (!got.equals(expected)) throw new Error('full content mismatch');
  console.log('  ok');

  console.log('[7/9] delete completed object...');
  await driver.delete(testKey);
  if (await driver.exists(testKey)) throw new Error('still exists after delete');
  console.log('  ok');

  // ============================================================
  // 测 abort: init → abort → 确认 OSS 上没残留
  // ============================================================
  console.log('[8/9] abortMultipartUpload test...');
  const abortKey = `_test/direct-abort-${Date.now()}.bin`;
  const init2 = await driver.initMultipartUpload(abortKey);
  // 上传 1 个 part, 然后 abort
  const abortUrl = await driver.createPresignedPutUrl(abortKey, init2.uploadId, 1, 600);
  const partBuf = Buffer.alloc(200 * 1024, 0x41);
  const res = await fetch(abortUrl, { method: 'PUT', body: partBuf });
  if (!res.ok) throw new Error('abort test: PUT failed');
  const abortEtag = res.headers.get('ETag') || res.headers.get('etag') || '';
  if (!abortEtag) throw new Error('abort test: no etag');
  console.log('  uploaded 1 part, calling abort...');
  await driver.abortMultipartUpload(abortKey, init2.uploadId);
  // abort 后, 重新 init 同样的 key 应该成功 (没有残留)
  const init3 = await driver.initMultipartUpload(abortKey);
  await driver.abortMultipartUpload(abortKey, init3.uploadId);
  console.log('  ok (re-init same key after abort works)');

  console.log('[9/9] abort of nonexistent uploadId (幂等)...');
  await driver.abortMultipartUpload(testKey, 'fake-upload-id-not-exist');
  console.log('  ok');

  console.log('OK - direct upload (init/presign/PUT/complete/abort) all working');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
