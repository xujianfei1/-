/**
 * NextAuth.js 路由处理器
 * /api/auth/signin, /api/auth/signout, /api/auth/session, /api/auth/callback/* 等
 */
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
