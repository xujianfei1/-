/**
 * Module augmentation for NextAuth v5.
 * 放在 .d.ts 让 TS 优先加载.
 *
 * 字段:
 *   - User.isAdmin / User.banned: authorize 返回值携带
 *   - Session.user.isAdmin / banned: 给 client 读
 *   - JWT.isAdmin / banned / bannedCheckAt: jwt callback 持久化, 每 60s 重查 ban
 */
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    isAdmin?: boolean;
    banned?: boolean;
  }

  interface Session {
    user: {
      id: string;
      isAdmin?: boolean;
      banned?: boolean;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    isAdmin?: boolean;
    banned?: boolean;
    bannedCheckAt?: number;
  }
}

export {};