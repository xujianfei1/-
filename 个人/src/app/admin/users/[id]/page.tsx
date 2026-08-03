/**
 * /admin/users/[id] - 查看某用户的文件 (admin 视角)
 * - 列出该用户全部 file (私人 + 在共享池创建的)
 * - 行内: 下载 / 删除
 *
 * 鉴权: RSC requireAdmin
 */
import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { Shield } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { listAllFilesForAdmin } from '@/lib/pan-queries';
import { prisma } from '@/lib/prisma';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { portalUrlFor } from '@/lib/portal-url';
import { AdminUserFilesTable } from './admin-user-files-table';

export const metadata = {
  title: 'Admin · 用户文件',
};

export const dynamic = 'force-dynamic';

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) {
    if (auth.status === 401) redirect('/signin?callbackUrl=/admin');
    return (
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 p-8">
          <h1 className="text-2xl font-semibold">无权访问</h1>
          <p className="mt-2 text-sm text-text-muted">{auth.error}</p>
        </main>
      </div>
    );
  }
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, isAdmin: true, banned: true, quotaBytes: true },
  });
  if (!user) notFound();

  // 列出该用户拥有的全部 file (私人 + 共享池里他创建的, ownerId=user.id)
  const files = await listAllFilesForAdmin({ ownerId: id, limit: 500 });
  const hdrs = await headers();
  const portalUrl = portalUrlFor(hdrs.get('host'));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar portalUrl={portalUrl} />
      <main className="flex-1 px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 text-xs">
            <a href="/admin" className="text-text-muted hover:text-text">
              ← Admin 控制台
            </a>
          </div>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold">
              {user.name || user.email}
              {user.isAdmin && (
                <span className="ml-2 align-middle inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                  <Shield className="h-3 w-3" />
                  admin
                </span>
              )}
              {user.banned && (
                <span className="ml-2 align-middle rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                  已封禁
                </span>
              )}
            </h1>
            <p className="mt-1 text-xs text-text-muted">{user.email}</p>
          </div>

          <AdminUserFilesTable
            files={files.map((f) => ({
              id: f.id,
              name: f.name,
              mimeType: f.mimeType,
              size: f.size,
              isDir: f.isDir,
              isShared: f.isShared,
              createdAt: f.createdAt.toISOString(),
            }))}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}