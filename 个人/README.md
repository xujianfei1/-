# 个人门户 (Personal Portal)

> 个人导航与服务大堂 · Next.js 15 全栈方案

Claude 风格的个人主页,聚合自建服务、常用链接、搜索/导航一体。支持深色模式、响应式、暗藏鉴权脚手架(可一键启用)。

## 技术栈

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **Next.js 15** (App Router) | RSC + Server Actions + Streaming |
| 语言 | **TypeScript 5.6** | 严格模式 + 路径别名 `@/*` |
| 样式 | **Tailwind CSS 3.4** | CSS 变量驱动双主题,shadcn/ui 设计语言 |
| 组件 | **shadcn/ui** | 按需复制到 `src/components/ui/`,可定制 |
| 数据库 | **Prisma 5 + SQLite** | 开发用文件,生产可平滑切 Postgres |
| 鉴权 | **NextAuth.js v5** | 凭据登录 + 可扩展 OAuth,默认关闭 |
| 校验 | **Zod** | API 入参、注册/登录、表单统一 |
| 数据流 | **TanStack Query** | 客户端缓存(为后续动态功能预留) |
| 字体 | **Inter + Noto Sans SC** | 中英混排 |
| 图标 | **lucide-react** | 1300+ SVG 图标 |
| 测试 | **Vitest** + Testing Library | 单元测试 |
| 部署 | **Docker** + **GitHub Actions** | 多阶段构建,自动 CI/CD |

## 目录结构

```
个人/
├── prisma/                       # 数据库 schema + seed
│   ├── schema.prisma             #   User/Service/Link/VisitLog 模型
│   └── seed.ts                   #   初始数据
├── public/                       # 静态资源
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            #   根布局 (字体、Providers、Toaster)
│   │   ├── page.tsx              #   主页 (RSC, 服务端取数)
│   │   ├── globals.css           #   全局样式 + CSS 变量主题
│   │   ├── not-found.tsx         #   404 页
│   │   ├── error.tsx             #   错误边界
│   │   ├── loading.tsx           #   加载态
│   │   └── api/                  # API 路由
│   │       ├── health/           #   健康检查
│   │       ├── auth/             #   NextAuth + 注册
│   │       ├── services/         #   服务 CRUD
│   │       └── links/            #   链接 CRUD
│   ├── components/
│   │   ├── ui/                   # shadcn 基础组件 (button, card, ...)
│   │   ├── home/                 # 主页业务组件
│   │   ├── shared/               # 通用业务组件
│   │   ├── topbar.tsx            # 顶部导航
│   │   ├── footer.tsx            # 页脚
│   │   ├── theme-toggle.tsx      # 主题切换
│   │   ├── providers.tsx         # 根 Providers (Session/Query/Theme)
│   │   └── icons.tsx             # 图标映射 (DB 字符串 → React 组件)
│   ├── lib/                      # 工具/配置层
│   │   ├── prisma.ts             #   Prisma 单例
│   │   ├── auth.ts               #   NextAuth 配置
│   │   ├── utils.ts              #   cn() / getGreeting() / isValidUrl()
│   │   ├── validations.ts        #   Zod schemas
│   │   ├── api.ts                #   前端 API 客户端
│   │   └── constants.ts          #   全局常量
│   ├── server/                   # 业务层 (Server-only)
│   │   ├── services.ts           #   Service CRUD
│   │   ├── links.ts              #   Link CRUD
│   │   └── users.ts              #   User CRUD + 密码哈希
│   └── types/
│       └── index.ts              # 共享类型
├── tests/
│   ├── setup.ts
│   └── unit/                     # 单元测试
├── .github/workflows/            # CI/CD
│   ├── ci.yml                    #   lint + typecheck + test + build
│   └── deploy.yml                #   SSH 部署到服务器
├── Dockerfile                    # 多阶段构建
├── docker-compose.yml            # 编排 (App + 可选 Postgres)
├── .env.example                  # 环境变量模板
├── README.md                     # 本文件
└── package.json
```

## 快速开始

### 1. 环境要求

- **Node.js** >= 20
- **pnpm** >= 9 (推荐, 也支持 npm/yarn)
- **Docker** + Docker Compose (生产部署用)

国内用户建议先设镜像源:
```bash
npm config set registry https://registry.npmmirror.com
pnpm config set registry https://registry.npmmirror.com
```

### 2. 本地开发

```bash
# 1. 复制环境变量
cp .env.example .env
# 编辑 .env, 修改 AUTH_SECRET: openssl rand -base64 32

# 2. 安装依赖 (postinstall 会自动跑 prisma generate)
pnpm install

# 3. 初始化数据库 + 写入种子数据
pnpm db:push      # 创建表结构
pnpm db:seed      # 写入示例服务与链接

# 4. 启动开发服务器
pnpm dev

# 浏览器打开 http://localhost:3000
```

### 3. 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 (热重载) |
| `pnpm build` | 生产构建 |
| `pnpm start` | 启动生产服务器 |
| `pnpm lint` | ESLint 检查 |
| `pnpm type-check` | TypeScript 类型检查 |
| `pnpm format` | Prettier 格式化 |
| `pnpm test` | 运行单元测试 |
| `pnpm test:watch` | 监视模式测试 |
| `pnpm db:studio` | 打开 Prisma Studio (可视化数据库) |
| `pnpm db:push` | 推送 schema 到数据库 (无迁移) |
| `pnpm db:migrate` | 创建并应用迁移 |
| `pnpm db:seed` | 写入种子数据 |
| `pnpm db:reset` | **危险**: 重置数据库 |

## 部署到服务器

### 方式 A: Docker (推荐)

服务器只需 Docker + Nginx:

```bash
# 1. 上传项目到服务器
scp -r 个人 root@your-server:/opt/

# 2. 在服务器上启动
cd /opt/个人
cp .env.example .env
vim .env  # 填入 AUTH_SECRET, NEXTAUTH_URL 等

docker compose up -d --build

# 3. 验证
curl http://127.0.0.1:3000/api/health
```

### Nginx 反向代理

添加到现有 Nginx 配置 (宝塔面板 → 站点 → 配置文件):

```nginx
server {
    listen 80;
    server_name portal.xujianfei.cn;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_read_timeout 30s;
    }
}
```

### 方式 B: GitHub Actions 自动部署

在 repo Settings → Secrets 配置:
- `SSH_HOST` / `SSH_USER` / `SSH_PORT` / `SSH_KEY` / `DEPLOY_PATH`

推送到 `main` 分支即触发 `.github/workflows/deploy.yml`。

## 后续开发指南

### 添加新的服务卡片

数据库直接改或用 API:

```bash
curl -X POST http://localhost:3000/api/services \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "新服务",
    "description": "描述",
    "url": "https://example.com",
    "icon": "home",
    "status": "online",
    "sortOrder": 9
  }'
```

可用图标: 查看 `src/components/icons.tsx` 中的 `ICON_MAP`,值是 lucide-react 图标名。

### 添加新的 API 路由

1. 在 `src/server/` 添加业务函数
2. 在 `src/app/api/your-route/route.ts` 创建路由
3. 用 `yourCreateSchema` (在 `src/lib/validations.ts`) 校验入参
4. 用 `prisma` 操作数据库
5. 写测试到 `tests/unit/`

### 启用鉴权 (登录注册)

1. 复制 `.env.example` 中的 `AUTH_SECRET`,生成: `openssl rand -base64 32`
2. `POST /api/auth/register` 注册用户
3. 前端调用 `signIn('credentials', { email, password })`
4. 服务端组件用 `await auth()` 获取 session
5. 路由保护示例:
   ```ts
   // src/server/services.ts
   import { auth } from '@/lib/auth';
   
   export async function createService(data: ServiceCreate) {
     const session = await auth();
     if (!session) throw new Error('Unauthorized');
     // ...
   }
   ```

### 切换到 Postgres

1. `docker-compose.yml` 取消注释 `postgres` 服务
2. `.env` 改 `DATABASE_URL="postgresql://portal:password@postgres:5432/portal"`
3. `prisma/schema.prisma` 改 `provider = "postgresql"`
4. `pnpm db:push` (或 `db:migrate`)

### 添加新的业务功能 (示例: 访问统计)

`prisma/schema.prisma` 已有 `VisitLog` 模型,接入:

```ts
// src/app/api/track/route.ts
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { path, referer } = await req.json();
  await prisma.visitLog.create({
    data: { path, referer, userAgent: req.headers.get('user-agent') ?? undefined },
  });
  return Response.json({ ok: true });
}
```

### 添加新页面

```bash
# 创建新路由
mkdir -p src/app/dashboard
# 创建 src/app/dashboard/page.tsx
```

App Router 文件即路由,无需配置。

## 已知限制 / 待办

- [ ] 服务管理 UI (目前需直接调 API 或改 DB)
- [ ] 拖拽排序
- [ ] 访问统计图表
- [ ] 移动端 PWA
- [ ] E2E 测试 (Playwright)
- [ ] i18n 多语言

## License

MIT
