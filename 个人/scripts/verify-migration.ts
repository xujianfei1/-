// 验证迁移后的文件能从 OSS 读出正确内容
import { OssDriver } from '../src/lib/storage/oss';

async function main() {
  const d = new OssDriver();
  const keys = await import('fs').then((fs) =>
    fs.promises
      .readdir('/www/pan_data', { withFileTypes: true })
      .then((dirs) => dirs.filter((d) => d.isDirectory()).map((d) => d.name)),
  );
  console.log('用户目录:', keys);

  for (const userId of keys) {
    const userPath = `/www/pan_data/${userId}`;
    const subdirs = await import('fs').then((fs) =>
      fs.promises.readdir(userPath, { withFileTypes: true }),
    );
    for (const sub of subdirs) {
      if (!sub.isDirectory()) continue;
      const files = await import('fs').then((fs) =>
        fs.promises.readdir(`${userPath}/${sub.name}`),
      );
      for (const f of files) {
        const key = `${userId}/${sub.name}/${f}`;
        if (!(await d.exists(key))) {
          console.log(`MISS ${key}`);
          continue;
        }
        const sz = await d.size(key);
        const s = await d.get(key);
        const chunks: Buffer[] = [];
        for await (const c of s) chunks.push(c as Buffer);
        const buf = Buffer.concat(chunks);
        const localSize = (await import('fs').then((fs) =>
          fs.promises.stat(`${userPath}/${sub.name}/${f}`),
        )).size;
        const match = sz === localSize && buf.length === localSize;
        const preview = buf.slice(0, 60).toString().replace(/\n/g, '\\n');
        console.log(
          `${match ? 'OK  ' : 'FAIL'} ${key} local=${localSize} oss=${sz} content="${preview}…"`,
        );
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
