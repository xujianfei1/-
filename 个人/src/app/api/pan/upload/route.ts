/**
 * POST /api/pan/upload
 * multipart/form-data:
 *   - parentId:  string (cuid 或 null, 表单字段)
 *   - isShared:  'true' | 'false'
 *   - name:      string (可选, 缺省用 file.name)
 *   - file:      File (binary)
 *
 * 流程:
 *   1. 鉴权
 *   2. 解析 multipart (Next 15 默认 body 限制 1MB, 需在 route config 调高)
 *   3. 配额检查
 *   4. 写 storage (本地流式)
 *   5. 创建 File 记录
 *
 * 注意: M1 不做分块, 单文件限制见下面 maxBodySize.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { checkQuota, createFileRecord, QuotaExceededError } from '@/lib/pan-queries';
import { uploadMetaSchema } from '@/lib/pan-validations';
import { getStorage } from '@/lib/storage';
import { randomBytes } from 'node:crypto';

export const dynamic = 'force-dynamic';
// Next 15 route segment config. 单文件上限 100 MB (M1); M2 加分块.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const userId = session.user.id;

  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    console.error('upload: formData parse failed:', e);
    return NextResponse.json({ error: 'multipart 解析失败' }, { status: 400 });
  }

  const metaParsed = uploadMetaSchema.safeParse({
    parentId: form.get('parentId') ?? null,
    isShared: form.get('isShared') ?? 'false',
    name: form.get('name') || undefined,
  });
  if (!metaParsed.success) {
    return NextResponse.json({ error: '参数无效', details: metaParsed.error.flatten() }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '缺少 file 字段' }, { status: 400 });
  }
  const name = metaParsed.data.name ?? file.name ?? 'unnamed';
  const size = BigInt(file.size);

  // 配额
  try {
    await checkQuota(userId, size);
  } catch (e) {
    if (e instanceof QuotaExceededError) {
      return NextResponse.json(
        {
          error: '配额已满',
          code: 'QUOTA_EXCEEDED',
          data: {
            used: e.used.toString(),
            limit: e.limit.toString(),
            adding: e.adding.toString(),
          },
        },
        { status: 413 },
      );
    }
    throw e;
  }

  // 物理存储
  const cuid = randomBytes(12).toString('base64url');
  const scope = metaParsed.data.isShared ? 'shared' : userId;
  const parentId = metaParsed.data.parentId ?? 'root';
  const storageKey = `${scope}/${parentId}/${cuid}__${name.replace(/[\\/]/g, '_')}`;
  const storage = getStorage();
  try {
    // File extends Blob → arrayBuffer → Buffer
    const buf = Buffer.from(await file.arrayBuffer());
    await storage.put(storageKey, buf);
  } catch (e) {
    console.error('upload: storage put failed:', e);
    return NextResponse.json({ error: '存储写入失败' }, { status: 500 });
  }

  try {
    const record = await createFileRecord(userId, {
      name,
      parentId: metaParsed.data.parentId,
      mimeType: file.type || 'application/octet-stream',
      size,
      storageKey,
      isShared: metaParsed.data.isShared,
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (e) {
    // 回滚物理文件
    await storage.delete(storageKey).catch(() => {});
    console.error('upload: db insert failed:', e);
    return NextResponse.json({ error: '创建文件记录失败' }, { status: 500 });
  }
}
