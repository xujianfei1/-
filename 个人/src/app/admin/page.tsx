/**
 * /admin - Admin 控制台首页
 * - 列出所有用户 + 各自统计
 * - 封禁/解封, 注销账号
 * - 点用户 → 看其文件
 *
 * 鉴权: RSC 端 requireAdmin (未登录 / 非 admin → 重定向 / 403)
 */
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { requireAdmin } from '@/lib/auth';
import { listUsersWithStats } from '@/lib/pan-queries';
import { Topbar } from '@/components/topbar';
import { Footer } from '@/components/footer';
import { portalUrlFor } from '@/lib/portal-url';
import { AdminUsersTable } from './admin-users-table';

export const metadata = {
  title: 'Admin 控制台',
};

export const dynamic = 'force-dynamic';

function formatBytes(n: bigint | string | number): string {
  const num = typeof n === 'bigint' ? Number(n) : Number(n);
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  if (num < 1024 * 1024 * 1024) return `${(num / 1024 / 1024).toFixed(1)} MB`;
  return `${(num / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default async function AdminPage() {
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
  const users = await listUsersWithStats();
  const hdrs = await headers();
  const portalUrl = portalUrlFor(hdrs.get('host'));

  // 系统总览
  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.isAdmin).length;
  const totalFiles = users.reduce((s, u) => s + u.fileCount, 0);
  const totalSize = users.reduce((s, u) => s + Number(u.totalSize), 0);
  const bannedCount = users.filter((u) => u.banned).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar portalUrl={portalUrl} />
      <main className="flex-1 px-4 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold">Admin 控制台</h1>
            <span className="text-xs text-text-muted">
              {auth.session.user.email}
            </span>
          </div>

          {/* 系统总览 */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="用户" value={totalUsers} />
            <Stat label="Admin" value={totalAdmins} />
            <Stat label="已封禁" value={bannedCount} />
            <Stat label="文件总数" value={totalFiles} />
            <Stat label="私人总用量" value={formatBytes(totalSize)} />
          </div>

          <AdminUsersTable
            users={users.map((u) => ({
              id: u.id,
              email: u.email ?? '(无邮箱)',
              name: u.name ?? '',
              isAdmin: u.isAdmin,
              banned: u.banned,
              fileCount: u.fileCount,
              totalSize: u.totalSize,
              quotaBytes: u.quotaBytes.toString(),
              createdAt: u.createdAt.toISOString(),
            }))}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-surface px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}