/**
 * POST /api/pan/share/[token]/access
 * Body: { password }
 * 验证分享密码, 验证成功返回一次性 downloadToken 用于下载链接
 *
 * Response: { data: { downloadToken } } (downloadToken 1 小时有效, 仅能用于本 share 的下载)
 */
import { NextResponse, type NextRequest } from 'next/server';
import { getShareByToken, touchShare } from '@/lib/pan-queries';
import { shareAccessSchema } from '@/lib/pan-validations';
import { issueDownloadToken } from '@/lib/share-token';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const share = await getShareByToken(token);
  if (!share) {
    return NextResponse.json({ error: '分享不存在' }, { status: 404 });
  }
  if (share.expiresAt && share.expiresAt < new Date()) {
    return NextResponse.json({ error: '分享已过期' }, { status: 410 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // 允许空 body
  }
  const parsed = shareAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '参数无效' }, { status: 400 });
  }

  // 有密码则必须匹配
  if (share.passwordHash) {
    if (!parsed.data.password) {
      return NextResponse.json({ error: '需要密码' }, { status: 401 });
    }
    const ok = await bcrypt.compare(parsed.data.password, share.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }
  }

  // 生成 downloadToken (1 小时有效, 仅本 share 可用)
  const downloadToken = issueDownloadToken(share.id);

  // 累加访问数
  await touchShare(share.id);

  return NextResponse.json({ data: { downloadToken } });
}
