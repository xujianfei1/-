# ============================================================
# 多阶段 Dockerfile
# Stage 1: deps      - 安装依赖
# Stage 2: builder   - 编译 Next.js (含 Prisma generate)
# Stage 3: runner    - 生产运行时, 镜像最小化
# ============================================================

# ---------- Stage 1: deps ----------
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

# 单独安装依赖以利用 Docker 缓存
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

# ---------- Stage 2: builder ----------
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js 收集遥测时关闭
ENV NEXT_TELEMETRY_DISABLED=1

# 1. 生成 Prisma client
# 2. 构建
RUN pnpm prisma generate
RUN pnpm build

# ---------- Stage 3: runner ----------
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

# 启动前等待 DB, 然后启动应用
CMD ["node", "server.js"]
