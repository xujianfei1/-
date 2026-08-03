// 端到端测 /api/pan/upload/direct/start + /direct/complete
// 模拟浏览器行为: 拿 cookie → 调 start → 用 fetch 直接 PUT 到 OSS → 调 complete
// 跑前确认 OSS 上 _test/ 没残留 (否则旧 multipart upload 会干扰)
//
// 用法: PAN_EMAIL=... PAN_PASSWORD=... pnpm tsx scripts/test-e2e-direct.ts
import { OssDriver } from '../src/lib/storage/oss';
import * as crypto from 'crypto';

const BASE = 'https://pan.xujianfei.cn';
const PART_SIZE = 5 * 1024 * 1024; // 5MB, 跟客户端 DIRECT_PART_SIZE 一致
const PART_COUNT = 3;
const TOTAL_SIZE = PART_SIZE * PART_COUNT;

function step(n: number, total: number, msg: string) {
  console.log(`[${n}/${total}] ${msg}`);
}

async function login(email: string, password: string): Promise<string> {
  // 1) 拿 csrf token + cookie (NextAuth v5 要求 cookie 也要带回去)
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  if (!csrfRes.ok) throw new Error(`csrf: HTTP ${csrfRes.status}`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  if (!csrfToken) throw new Error('no csrfToken');
  const csrfCookies = csrfRes.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  // 2) POST /api/auth/callback/credentials. cookie 必须带 csrf cookie 一起回
  const form = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE}/pan`,
    json: 'true',
  });
  const signinRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: csrfCookies },
    body: form.toString(),
    redirect: 'manual',
  });
  if (signinRes.status >= 400) {
    throw new Error(`signin: HTTP ${signinRes.status}`);
  }
  // 看 location header 判断是否成功
  const location = signinRes.headers.get('location') || '';
  if (location.includes('error=')) {
    throw new Error(`signin failed: location=${location}`);
  }
  const setCookies = signinRes.headers.getSetCookie();

  // 3) 用所有 cookie (csrf + signin 返的) 拿 session
  const allCookies = [csrfCookies, ...setCookies.map((c) => c.split(';')[0])].join('; ');
  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: allCookies },
  });
  const session = (await sessionRes.json()) as { user?: { id: string; email: string } };
  if (!session.user) {
    throw new Error(`login failed, session=${JSON.stringify(session)}`);
  }
  console.log(`  logged in as ${session.user.email} (${session.user.id})`);
  return allCookies;
}

async function main() {
  const email = process.env.PAN_EMAIL;
  const password = process.env.PAN_PASSWORD;
  if (!email || !password) {
    throw new Error('set PAN_EMAIL and PAN_PASSWORD env vars');
  }
  const fileName = `_e2e-${Date.now()}.bin`;
  const TOTAL = 9;

  step(1, TOTAL, 'login...');
  const cookie = await login(email, password);

  step(2, TOTAL, 'POST /api/pan/upload/direct/start...');
  const startRes = await fetch(`${BASE}/api/pan/upload/direct/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: fileName,
      fileSize: TOTAL_SIZE,
      mimeType: 'application/octet-stream',
      chunkSize: PART_SIZE,
      parentId: null,
      isShared: false,
    }),
  });
  if (!startRes.ok) {
    const text = await startRes.text();
    throw new Error(`start failed: HTTP ${startRes.status} ${text}`);
  }
  const start = (await startRes.json()) as {
    data: {
      uploadId: string;
      fileKey: string;
      partSize: number;
      totalParts: number;
      parts: Array<{ partNumber: number; putUrl: string }>;
    };
  };
  const { uploadId, fileKey, totalParts, parts } = start.data;
  console.log(`  uploadId=${uploadId}, fileKey=${fileKey}, totalParts=${totalParts}`);
  if (totalParts !== PART_COUNT) throw new Error(`totalParts=${totalParts} != ${PART_COUNT}`);
  if (parts.length !== PART_COUNT) throw new Error(`parts.length mismatch`);
  // 关键验证 1: putUrl 必须指 oss-cn-hangzhou-internal (或外网), 不能是 pan.xujianfei.cn
  for (const p of parts) {
    if (p.putUrl.includes('pan.xujianfei.cn')) {
      throw new Error(`putUrl still goes through next-server: ${p.putUrl}`);
    }
    if (!p.putUrl.includes('aliyuncs.com')) {
      throw new Error(`putUrl not aliyun: ${p.putUrl}`);
    }
  }
  console.log(`  ✓ putUrl goes directly to OSS (bypasses next-server)`);

  step(3, TOTAL, 'PUT each part to OSS (simulating browser)...');
  const etags: Array<{ partNumber: number; etag: string }> = [];
  for (let i = 0; i < PART_COUNT; i++) {
    const partBuf = Buffer.alloc(PART_SIZE, 0x41 + i);
    const sha = crypto.createHash('sha256').update(partBuf).digest('hex').slice(0, 12);
    const r = await fetch(parts[i]!.putUrl, { method: 'PUT', body: partBuf });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      throw new Error(`PUT part ${i + 1} failed: HTTP ${r.status} ${text}`);
    }
    const etag = r.headers.get('ETag') || r.headers.get('etag');
    if (!etag) throw new Error(`part ${i + 1} no ETag`);
    etags.push({ partNumber: i + 1, etag });
    console.log(`  part${i + 1} PUT OK (sha256 ${sha}…), etag=${etag}`);
  }

  step(4, TOTAL, 'POST /direct/complete...');
  const completeRes = await fetch(
    `${BASE}/api/pan/upload/${uploadId}/direct/complete`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ parts: etags }),
    },
  );
  if (completeRes.status !== 201) {
    const text = await completeRes.text();
    throw new Error(`complete failed: HTTP ${completeRes.status} ${text}`);
  }
  const complete = (await completeRes.json()) as { data: { id: string; name: string; size: string } };
  console.log(`  ✓ file created: id=${complete.data.id} name=${complete.data.name} size=${complete.data.size}`);
  if (BigInt(complete.data.size) !== BigInt(TOTAL_SIZE)) {
    throw new Error(`size mismatch: ${complete.data.size} != ${TOTAL_SIZE}`);
  }

  step(5, TOTAL, 'verify file appears in /api/pan/files...');
  // 列出根目录
  const listRes = await fetch(`${BASE}/api/pan/files?parentId=`, { headers: { cookie } });
  if (!listRes.ok) throw new Error(`list failed: HTTP ${listRes.status}`);
  const list = (await listRes.json()) as { data: Array<{ id: string; name: string; size: string }> };
  const found = list.data.find((f) => f.id === complete.data.id);
  if (!found) throw new Error('file not in list');
  console.log(`  ✓ file in list: ${found.name} (${found.size} bytes)`);

  step(6, TOTAL, 'verify object exists in OSS and parts cleared...');
  const driver = new OssDriver();
  const size = await driver.size(fileKey);
  console.log(`  OSS size=${size} (expected ${TOTAL_SIZE})`);
  if (size !== TOTAL_SIZE) throw new Error('OSS size mismatch');
  // 用 SDK 查 multipart upload 残留 (按 prefix)
  const client = (driver as any).client;
  const mpList = await client.listUploads({ 'max-uploads': 1000 });
  const remaining = (mpList.uploads || []).filter((u: any) => u.name === fileKey);
  if (remaining.length > 0) {
    throw new Error(`multipart upload still pending for ${fileKey}: ${JSON.stringify(remaining)}`);
  }
  console.log(`  ✓ no multipart upload residue for ${fileKey}`);

  step(7, TOTAL, 'cleanup: delete the uploaded file from pan + OSS...');
  const delRes = await fetch(`${BASE}/api/pan/files/${complete.data.id}`, {
    method: 'DELETE',
    headers: { cookie },
  });
  if (!delRes.ok) throw new Error(`delete failed: HTTP ${delRes.status}`);
  const exists = await driver.exists(fileKey);
  if (exists) throw new Error('OSS object still exists after pan delete');
  console.log(`  ✓ pan record + OSS object both gone`);

  // ============================================================
  // 测 abort: start → abort, 应无残留
  // ============================================================
  step(8, TOTAL, 'abort test: start → abort...');
  const abortFileName = `_e2e-abort-${Date.now()}.bin`;
  const start2 = await fetch(`${BASE}/api/pan/upload/direct/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      name: abortFileName,
      fileSize: TOTAL_SIZE,
      mimeType: 'application/octet-stream',
      chunkSize: PART_SIZE,
      parentId: null,
      isShared: false,
    }),
  });
  if (!start2.ok) throw new Error(`abort start failed: HTTP ${start2.status}`);
  const start2Data = (await start2.json()) as { data: { uploadId: string; fileKey: string; parts: Array<{ partNumber: number; putUrl: string }> } };
  // 实际 PUT 1 个 part, 再 abort
  const part0 = Buffer.alloc(PART_SIZE, 0x41);
  const r = await fetch(start2Data.data.parts[0]!.putUrl, { method: 'PUT', body: part0 });
  if (!r.ok) throw new Error(`abort test PUT failed: HTTP ${r.status}`);
  console.log(`  uploaded 1 part, calling DELETE /upload/${start2Data.data.uploadId}...`);
  const abortRes = await fetch(
    `${BASE}/api/pan/upload/${start2Data.data.uploadId}`,
    { method: 'DELETE', headers: { cookie } },
  );
  if (!abortRes.ok) throw new Error(`abort failed: HTTP ${abortRes.status}`);
  // 验证 OSS 上没残留 multipart
  const mpList2 = await client.listUploads({ 'max-uploads': 1000 });
  const remaining2 = (mpList2.uploads || []).filter((u: any) => u.name === start2Data.data.fileKey);
  if (remaining2.length > 0) {
    throw new Error(`multipart upload still pending after abort: ${JSON.stringify(remaining2)}`);
  }
  console.log(`  ✓ abort cleared OSS parts`);

  step(9, TOTAL, 'all checks passed ✓');
  console.log('\n=== E2E PASS ===');
}

main().catch((e) => {
  console.error('\n=== E2E FAIL ===');
  console.error(e);
  process.exit(1);
});
