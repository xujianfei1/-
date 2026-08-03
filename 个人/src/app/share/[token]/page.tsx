/**
 * /share/[token] - 公开访问分享页面
 * - 不需要登录
 * - RSC 直接 fetch share metadata (server-side)
 * - 文件夹会展示下面的文件列表 (递归)
 */
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { ShareView } from './share-view';
import { getShareByToken } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';
import { portalUrlFor } from '@/lib/portal-url';

export const dynamic = 'force-dynamic';
export const metadata = { title: '分享文件' };

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await getShareByToken(token);
  if (!share) notFound();
  const expired = !!(share.expiresAt && share.expiresAt < new Date());

  // 拉 file
  const file = await prisma.file.findUnique({
    where: { id: share.fileId },
    select: { id: true, name: true, size: true, isDir: true, mimeType: true },
  });

  const hdrs = await headers();
  const portalUrl = portalUrlFor(hdrs.get('host'));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar portalUrl={portalUrl} />
      <main className="flex-1">
        <ShareView
          token={token}
          shareMeta={{
            hasPassword: !!share.passwordHash,
            allowDownload: share.allowDownload,
            expiresAt: share.expiresAt?.toISOString() ?? null,
            expired,
            accessCount: share.accessCount,
          }}
          file={file ? {
            id: file.id,
            name: file.name,
            size: file.size.toString(),
            isDir: file.isDir,
            mimeType: file.mimeType,
          } : null}
        />
      </main>
      <Footer />
    </div>
  );
}
