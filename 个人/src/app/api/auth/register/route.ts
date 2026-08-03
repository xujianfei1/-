/**
 * POST /api/auth/register
 * 用户注册 (默认关闭, 启用鉴权时使用)
 *
 * 调用示例:
 *   fetch('/api/auth/register', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ name: 'Xu', email: 'me@example.com', password: '123456' })
 *   })
 */
import { NextResponse, type NextRequest } from 'next/server';
import { registerSchema } from '@/lib/validations';
import { getUserByEmail, createUser } from '@/server/users';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数无效', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const exists = await getUserByEmail(parsed.data.email);
    if (exists) {
      return NextResponse.json({ error: '邮箱已被注册' }, { status: 409 });
    }

    const user = await createUser(parsed.data);
    return NextResponse.json({ data: user }, { status: 201 });
  } catch (err) {
    console.error('Register error:', err);
    return NextResponse.json({ error: '注册失败' }, { status: 500 });
  }
}
