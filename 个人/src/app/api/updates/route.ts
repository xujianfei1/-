/**
 * GET  /api/updates  - 更新日志列表 (公开, 最新在前)
 * POST /api/updates  - 发布更新公告 (仅 admin)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { changelogCreateSchema } from '@/lib/changelog-validations';
import { getChangelogs, createChangelog } from '@/server/changelogs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({ data: await getChangelogs() });
  } catch (err) {
    console.error('GET /api/updates failed:', err);
    return NextResponse.json({ error: '获取更新日志失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await req.json();
    const parsed = changelogCreateSchema.safeParse(body);
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const first = flat.title?.[0] ?? flat.body?.[0] ?? '参数无效';
      return NextResponse.json({ error: first }, { status: 400 });
    }
    const entry = await createChangelog(parsed.data);
    return NextResponse.json({ data: entry }, { status: 201 });
  } catch (err) {
    console.error('POST /api/updates failed:', err);
    return NextResponse.json({ error: '发布失败' }, { status: 500 });
  }
}
