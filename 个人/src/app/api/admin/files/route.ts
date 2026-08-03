/**
 * GET /api/admin/files?ownerId=X&isShared=true|false&q=xxx
 * Admin 全局列文件 (支持过滤).
 *
 * 鉴权: requireAdmin
 */
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { listAllFilesForAdmin } from '@/lib/pan-queries';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const url = new URL(req.url);
  const ownerId = url.searchParams.get('ownerId');
  const isSharedParam = url.searchParams.get('isShared');
  const q = url.searchParams.get('q')?.trim() || undefined;
  const filters: Parameters<typeof listAllFilesForAdmin>[0] = {};
  if (ownerId) filters.ownerId = ownerId;
  if (isSharedParam === 'true') filters.isShared = true;
  else if (isSharedParam === 'false') filters.isShared = false;
  if (q) filters.q = q;
  try {
    const items = await listAllFilesForAdmin(filters);
    return NextResponse.json({ data: items });
  } catch (e) {
    console.error('admin list files failed:', e);
    return NextResponse.json({ error: '获取文件列表失败' }, { status: 500 });
  }
}