/**
 * GET  /api/pan/files?parentId=...&scope=private|shared
 * POST /api/pan/files  (body: { name, parentId, isShared })
 *
 * 鉴权: NextAuth session
 * 错误: 401 未登录, 400 参数无效, 500 其他
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth';
import { listChildren, createFolder, type Scope } from '@/lib/pan-queries';
import { listFilesQuerySchema, createFolderSchema } from '@/lib/pan-validations';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() || undefined;
  const parsed = listFilesQuerySchema.safeParse({
    parentId: url.searchParams.get('parentId') ?? null,
    scope: url.searchParams.get('scope') ?? 'private',
    q,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: '参数无效', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const items = await listChildren(session.user.id, parsed.data.parentId, parsed.data.scope as Scope, parsed.data.q);
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('list files failed:', e);
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const a = await requireActiveUser();
  if ('error' in a) return NextResponse.json({ error: a.error }, { status: a.status });
  const session = a.session;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体必须为 JSON' }, { status: 400 });
  }
  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数无效', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const folder = await createFolder(session.user.id, parsed.data);
    return NextResponse.json({ data: folder }, { status: 201 });
  } catch (e) {
    console.error('create folder failed:', e);
    return NextResponse.json({ error: '创建文件夹失败' }, { status: 500 });
  }
}
