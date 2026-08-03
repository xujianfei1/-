// 一次性迁移脚本: local → OSS
// 读 /www/pan_data/<storageKey>, 写到 OSS 同 key, 验证大小
//
// 用法 (在 ECS, 项目根目录):
//   ./node_modules/.bin/tsx scripts/migrate-local-to-oss.ts
//
// 安全:
//   - 不会删本地文件, 迁移完你自己决定
//   - 幂等: OSS 已有且大小一致会跳过
//   - 失败的不动 OSS, 列在末尾
import { LocalDriver } from '../src/lib/storage/local';
import { OssDriver } from '../src/lib/storage/oss';
import { prisma } from '../src/lib/prisma';

const LOCAL_ROOT = '/www/pan_data';
const CONCURRENCY = 5;

async function main() {
  const local = new LocalDriver(LOCAL_ROOT);
  const oss = new OssDriver();

  // 1. 拿所有有 storageKey 的文件 (目录 storageKey=null, 跳过)
  const files = await prisma.file.findMany({
    where: { storageKey: { not: null } },
    select: {
      id: true,
      storageKey: true,
      size: true,
      name: true,
      isShared: true,
      isDir: true,
    },
    orderBy: [{ isShared: 'asc' }, { createdAt: 'asc' }],
  });

  console.log(`待迁移文件: ${files.length} 个 (按 isShared + createdAt 排序, 私人在前)`);

  let ok = 0;
  let skipLocalMissing = 0;
  let skipAlreadyDone = 0;
  let fail = 0;
  const failures: Array<{ id: string; name: string; err: string }> = [];
  const localMissing: Array<{ id: string; name: string; key: string }> = [];

  let nextIdx = 0;
  async function worker(workerId: number) {
    while (true) {
      const i = nextIdx++;
      if (i >= files.length) return;
      const f = files[i]!;
      const key = f.storageKey!;
      const dbSize = Number(f.size);
      const tag = `[${String(i + 1).padStart(4)}/${files.length} w${workerId}]`;

      try {
        if (!(await local.exists(key))) {
          localMissing.push({ id: f.id, name: f.name, key });
          skipLocalMissing++;
          console.log(`${tag} skip (local 缺): ${f.name}`);
          continue;
        }
        if (await oss.exists(key)) {
          const ossSize = await oss.size(key);
          if (ossSize === dbSize) {
            skipAlreadyDone++;
            console.log(`${tag} skip (OSS 已有 ${ossSize}B): ${f.name}`);
            continue;
          }
        }
        const stream = await local.get(key);
        await oss.put(key, stream);
        const ossSize = await oss.size(key);
        if (ossSize !== dbSize) {
          throw new Error(`size 不一致: DB=${dbSize} OSS=${ossSize}`);
        }
        ok++;
        console.log(`${tag} ok ${formatBytes(dbSize)}: ${f.name}`);
      } catch (e) {
        fail++;
        const msg = (e as Error).message;
        failures.push({ id: f.id, name: f.name, err: msg });
        console.error(`${tag} FAIL ${f.name}: ${msg}`);
      }
    }
  }

  const t0 = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== 完成 (${dt}s) ===`);
  console.log(`成功: ${ok} | 跳过 (OSS 已有): ${skipAlreadyDone} | 跳过 (local 缺): ${skipLocalMissing} | 失败: ${fail}`);

  if (failures.length > 0) {
    console.log(`\n失败清单:`);
    for (const f of failures) console.log(`  ${f.name} (id=${f.id}): ${f.err}`);
  }
  if (localMissing.length > 0) {
    console.log(`\n本地缺失 (DB 里有记录, local 找不到, 这些下载会一直 404, 建议人工清掉):`);
    for (const f of localMissing) console.log(`  ${f.name} (id=${f.id}) key=${f.key}`);
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  });
