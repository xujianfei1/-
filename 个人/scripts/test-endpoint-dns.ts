// 测两个 client 签出来的 URL 分别走什么 endpoint
import { OssDriver } from '../src/lib/storage/oss';

async function main() {
  const d = new OssDriver() as any;
  const key = `_test/dns-${Date.now()}.bin`;
  const { uploadId } = await d.initMultipartUpload(key);
  await d.abortMultipartUpload(key, uploadId).catch(() => {});

  // 1. 用 this.client 签 (旧行为, 内网)
  const initUrl = await d.initMultipartUpload(key);
  const urlInternal = await d.client.signatureUrl(key, { method: 'PUT', expires: 600, subResource: { partNumber: 1, uploadId: initUrl.uploadId } });
  await d.abortMultipartUpload(key, initUrl.uploadId).catch(() => {});

  // 2. 用 this.publicClient 签 (新行为, 给浏览器用的)
  const initUrl2 = await d.initMultipartUpload(key);
  const urlPublic = await d.publicClient.signatureUrl(key, { method: 'PUT', expires: 600, subResource: { partNumber: 1, uploadId: initUrl2.uploadId } });
  await d.abortMultipartUpload(key, initUrl2.uploadId).catch(() => {});

  console.log('=== this.client (内网 client) 签的 URL ===');
  console.log(urlInternal);
  console.log('  host:', new URL(urlInternal).host);
  console.log('  is internal endpoint:', new URL(urlInternal).host.includes('-internal'));
  console.log();
  console.log('=== this.publicClient (公网 client) 签的 URL ===');
  console.log(urlPublic);
  console.log('  host:', new URL(urlPublic).host);
  console.log('  is internal endpoint:', new URL(urlPublic).host.includes('-internal'));
  console.log();
  // 注意: SDK initMultipartUpload 也走 this.client (内网), 那一步是服务端操作, 用内网正常.
  // 只有 signatureUrl 给浏览器用的那一步必须走公网.
  console.log('(initMultipartUpload 走 this.client 是 OK 的 — 服务端操作, 用内网更快)')
}
main().catch((e) => { console.error('FAIL:', e); process.exit(1); });