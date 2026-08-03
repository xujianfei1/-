// 一次性 OSS 联通性测试
// 用法 (在项目根目录):
//   node --env-file=.env scripts/test-oss.mjs
import OSS from 'ali-oss';

const client = new OSS({
  region: process.env.OSS_REGION,
  bucket: process.env.OSS_BUCKET,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  internal: process.env.OSS_INTERNAL === 'true',
  secure: true,
});

const testKey = `_test/conn-${Date.now()}.txt`;
const testData = Buffer.from('hello oss ' + new Date().toISOString(), 'utf-8');

console.log('[1/5] put...');
await client.put(testKey, testData, { headers: { 'Content-Type': 'text/plain' } });
await new Promise((r) => setTimeout(r, 200));

console.log('[2/5] head (size)...');
const head = await client.head(testKey);
const headerSize = Number(head.res.headers['content-length'] ?? head.res.headers['Content-Length'] ?? 0);
console.log(`  head.res.size=${head.res.size} headerSize=${headerSize} (expected ${testData.length})`);
if (headerSize !== testData.length) throw new Error('put verification failed (header size wrong)');

console.log('[3/5] getStream...');
const { stream } = await client.getStream(testKey);
const chunks = [];
for await (const chunk of stream) chunks.push(chunk);
const got = Buffer.concat(chunks);
if (got.toString() !== testData.toString()) throw new Error(`get mismatch: got ${got.toString()}`);
console.log(`  got: ${got.toString()}`);

console.log('[4/5] concat (multipart + UploadPartCopy)...');
const part1 = `${testKey}.p1`;
const part2 = `${testKey}.p2`;
const concatKey = `${testKey}.concat`;
// OSS multipart 单 part 最小 100KB (除了最后一块), 用 100KB+ 的填充数据
const filler = 'x'.repeat(100 * 1024);
await client.put(part1, Buffer.from(filler + 'PART1-END', 'utf-8'));
await client.put(part2, Buffer.from(filler + 'PART2-END', 'utf-8'));
const { uploadId } = await client.initMultipartUpload(concatKey);
const size1 = (await client.head(part1)).res.headers['content-length'];
const size2 = (await client.head(part2)).res.headers['content-length'];
const r1 = await client.uploadPartCopy(concatKey, uploadId, 1, `0-${Number(size1) - 1}`,
  { sourceKey: part1, sourceBucketName: process.env.OSS_BUCKET }, { timeout: 120_000 });
const r2 = await client.uploadPartCopy(concatKey, uploadId, 2, `0-${Number(size2) - 1}`,
  { sourceKey: part2, sourceBucketName: process.env.OSS_BUCKET }, { timeout: 120_000 });
await client.completeMultipartUpload(concatKey, uploadId, [
  { number: 1, etag: r1.etag },
  { number: 2, etag: r2.etag },
]);
const concatHeaderSize = (await client.head(concatKey)).res.headers['content-length'];
console.log(`  concat size=${concatHeaderSize} (expected ${Number(size1) + Number(size2)})`);
if (Number(concatHeaderSize) !== Number(size1) + Number(size2)) throw new Error('concat size mismatch');

console.log('[5/5] delete...');
await client.deleteMulti([testKey, part1, part2, concatKey]);

console.log('OK - OSS driver fully working');
