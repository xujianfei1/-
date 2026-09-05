const OSS = require('ali-oss');
const fs = require('fs');

/**
 * 通用 OSS 上传器 (服务器本地运维用, 不入 Git)
 * 用法: node oss-put.js <本地文件> <OSS目标Key>
 * 校验大小一致后才算成功
 */
const [local, key] = process.argv.slice(2);
if (!local || !key) {
  console.error('用法: node oss-put.js <local> <ossKey>');
  process.exit(1);
}

const c = new OSS({
  region: process.env.OSS_REGION,
  bucket: process.env.OSS_BUCKET,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  internal: process.env.OSS_INTERNAL === 'true',
});

(async () => {
  const size = fs.statSync(local).size;
  await c.put(key, local);
  const head = await c.head(key);
  if (Number(head.res.headers['content-length']) !== size) {
    console.error('大小校验失败:', key);
    process.exit(1);
  }
  console.log(`已上传: ${key} (${(size / 1024).toFixed(1)}KB)`);
})().catch((e) => {
  console.error('上传失败:', e.message);
  process.exit(1);
});
