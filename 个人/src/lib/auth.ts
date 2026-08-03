/**
 * NextAuth.js v5 配置
 * 凭据登录 (账号密码) + 可扩展 OAuth
 *
 * 启用鉴权:
 *   1. 创建 User: POST /api/auth/register
 *   2. 登录: 调用 signIn('credentials', { email, password })
 *   3. 获取 session: const session = await auth()
 *
 * Admin / Ban 字段:
 *   - User.isAdmin / User.banned (schema)
 *   - 透出到 session.user.isAdmin / session.user.banned
 *   - signIn callback 拒 banned
 *   - jwt callback 每 60s 重新查 ban 状态 (撤销延迟 ≤ 60s)
 */
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './prisma';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/** 跨子域共享 session cookie */
function isProd() {
  return process.env.NODE_ENV === 'production';
}

function rootDomain() {
  const url = process.env.NEXTAUTH_URL ?? '';
  try {
    const host = new URL(url).hostname;
    const parts = host.split('.');
    if (parts.length < 2 || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.endsWith('.localhost')) {
      return undefined;
    }
    return '.' + parts.slice(-2).join('.');
  } catch {
    return undefined;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/signin',
  },
  cookies: isProd() && rootDomain()
    ? {
        sessionToken: {
          name: 'authjs.session-token',
          options: {
            domain: rootDomain(),
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
          },
        },
      }
    : undefined,
  providers: [
    Credentials({
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, email: true, name: true, image: true, passwordHash: true, isAdmin: true, banned: true },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          isAdmin: user.isAdmin,
          banned: user.banned,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // ban: 即便 authorize 通过, 登录前再查一次 DB (防 authorize 期间被 ban)
      if (user.id) {
        const u = await prisma.user.findUnique({
          where: { id: user.id },
          select: { banned: true },
        });
        if (u?.banned) return false;
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      // 首次登录: 写全 flags
      if (user?.id) {
        token.id = user.id;
        token.isAdmin = !!(user as { isAdmin?: boolean }).isAdmin;
        token.banned = !!(user as { banned?: boolean }).banned;
        token.bannedCheckAt = Date.now();
        // 拿 passwordChangedAt 决定 token 是否还合法
        const u = await prisma.user.findUnique({
          where: { id: user.id },
          select: { passwordChangedAt: true },
        });
        token.passwordChangedAt = u?.passwordChangedAt?.getTime() ?? 0;
      } else if (token.id) {
        // 已有 token: 每 60s 重查 ban + passwordChangedAt
        const now = Date.now();
        const last = (token.bannedCheckAt as number | undefined) ?? 0;
        if (now - last > 60_000 || trigger === 'update') {
          const u = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { banned: true, passwordChangedAt: true },
          });
          token.banned = !!u?.banned;
          // 若密码在 token 签发后被改过 (passwordChangedAt > token.iat), 失效该 token
          if (u?.passwordChangedAt) {
            const changed = u.passwordChangedAt.getTime();
            const iat = (token.iat as number | undefined) ?? 0;
            if (changed > iat) {
              return null as unknown as typeof token;
            }
            token.passwordChangedAt = changed;
          }
          token.bannedCheckAt = now;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      (session.user as { isAdmin?: boolean }).isAdmin = !!token.isAdmin;
      (session.user as { banned?: boolean }).banned = !!token.banned;
      return session;
    },
  },
});

/** 鉴权辅助 - 路由保护 (登录即可). */
export async function requireAuth() {
  return auth();
}

/**
 * 鉴权辅助 - 要求 admin + 未 ban.
 * 每次从 DB 查最新 (不走 JWT 缓存, 防止 token 缓存绕过 isAdmin).
 *
 * 用法:
 *   const r = await requireAdmin();
 *   if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status });
 *   const { session } = r;
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: '未登录' as const, status: 401 };
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true, banned: true },
  });
  if (!u) return { error: '未登录' as const, status: 401 };
  if (u.banned) return { error: '账号已封禁' as const, status: 403 };
  if (!u.isAdmin) return { error: '需要 admin 权限' as const, status: 403 };
  return { session };
}

/**
 * 鉴权辅助 - 要求未 ban 的登录用户.
 * 每次从 DB 查 ban (撤销生效延迟 ≈ 0).
 */
export async function requireActiveUser() {
  const session = await auth();
  if (!session?.user?.id) return { error: '未登录' as const, status: 401 };
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { banned: true },
  });
  if (!u) return { error: '未登录' as const, status: 401 };
  if (u.banned) return { error: '账号已封禁' as const, status: 403 };
  return { session, userId: session.user.id };
}

// 类型扩展见 src/types/next-auth.d.ts