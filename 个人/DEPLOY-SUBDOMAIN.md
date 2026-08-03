# 个人门户 + 经期预测 — 子域名部署指南

> 阿里云 ECS `114.215.182.68` · 域 `xujianfei.cn` · 子域 `me.` / `period.`

---

## 0. 架构

```
                ┌─────────────────────────────────────┐
                │   阿里云 DNS (xujianfei.cn)         │
                │   me.    A → 114.215.182.68         │
                │   period.A → 114.215.182.68         │
                └──────────────┬──────────────────────┘
                               │ 443
                ┌──────────────▼──────────────────────┐
                │   Nginx (443)                       │
                │   me.xujianfei.cn        → :3000    │
                │   period.xujianfei.cn    → :3000    │  (同一 Next.js)
                └──────────────┬──────────────────────┘
                               │ localhost
                ┌──────────────▼──────────────────────┐
                │   Next.js (:3000)                   │
                │   middleware.ts:                    │
                │     period.* → rewrite /period      │
                │     其它 → 正常路由                 │
                └──────────────┬──────────────────────┘
                               │  HMAC + X-Portal-*
                ┌──────────────▼──────────────────────┐
                │   Flask (:5001) 仅 localhost        │
                └─────────────────────────────────────┘
```

- 浏览器只看得到 `me.xujianfei.cn` 和 `period.xujianfei.cn`
- Flask 端口 5001 **永远不开公网**
- 同一份 Next.js 用 middleware 根据 Host 头把 `period.xujianfei.cn` 内部重写到 `/period`
- NextAuth session cookie 在生产环境设到 `.xujianfei.cn`,两个子域共享登录态

---

## 1. 阿里云 DNS 解析 (云解析 DNS)

控制台 → `xujianfei.cn` → 解析设置 → 添加记录:

| 主机记录 | 记录类型 | 记录值 | TTL |
|---|---|---|---|
| `@` | A | `114.215.182.68` | 600 (已有) |
| `www` | A | `114.215.182.68` | 600 (已有) |
| `me` | A | `114.215.182.68` | 600 (新增) |
| `period` | A | `114.215.182.68` | 600 (新增) |

> 如果用 CDN / 阿里云 OSS, 把 A 改成 CNAME 指向 CDN 域名. 此处按直连 ECS 写.

---

## 2. 服务器目录结构

```bash
# 在 ECS 上 (root 用户)
/root/portal/                   # Next.js 项目 (从本地 scp 上来)
    ├── .env                     # 见 §5
    ├── src/
    ├── public/
    ├── node_modules/
    └── ...

/root/period-tracker/           # Flask 项目 (Flask 部署时再传)
    ├── .env                     # 见 §5
    ├── app.py
    ├── auth_bridge.py
    └── ...
```

> 用 `scp -r` 同步, 排除 `node_modules` `instance` `.env` `.next` `__pycache__`.

---

## 3. 申请 HTTPS 证书 (宝塔 / acme.sh)

### 方案 A: 宝塔面板 (推荐, GUI)

宝塔 → 网站 → 添加站点:
- 域名 1: `me.xujianfei.cn`
- 域名 2: `period.xujianfei.cn`
- 备注: 个人门户
- PHP: 纯静态
- 数据库: 不创建

提交后, 在站点列表里点该站点 → SSL → Let's Encrypt → 勾选两个域名 → 申请. 宝塔会自动续期.

### 方案 B: acme.sh (命令行)

```bash
ssh root@114.215.182.68
curl https://get.acme.sh | sh
source ~/.bashrc

# 临时停 nginx 释放 80
systemctl stop nginx

acme.sh --issue -d me.xujianfei.cn -d period.xujianfei.cn --standalone

# 装到 nginx 目录
mkdir -p /etc/nginx/certs
acme.sh --install-cert -d me.xujianfei.cn \
  --key-file       /etc/nginx/certs/me.key  \
  --fullchain-file /etc/nginx/certs/me.pem  \
  --reloadcmd      "systemctl reload nginx"
# 同样的命令把 period.xujianfei.cn 也装一份 (但同一个 fullchain 就行)
```

---

## 4. Nginx 反向代理

新建 `/etc/nginx/conf.d/portal.conf`:

```nginx
# ============================================================
# HTTP → HTTPS 重定向
# ============================================================
server {
    listen 80;
    server_name me.xujianfei.cn period.xujianfei.cn;
    return 301 https://$host$request_uri;
}

# ============================================================
# HTTPS: 共享一份配置, 用 server_name 区分
# ============================================================
server {
    listen 443 ssl http2;
    server_name me.xujianfei.cn period.xujianfei.cn;

    ssl_certificate     /etc/nginx/certs/me.pem;     # fullchain 含两个域
    ssl_certificate_key /etc/nginx/certs/me.key;

    # 安全 headers
    add_header X-Frame-Options          "SAMEORIGIN"           always;
    add_header X-Content-Type-Options   "nosniff"              always;
    add_header Referrer-Policy          "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    client_max_body_size 10M;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # 通用: 转发到 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;            # 关键: 让 Next.js 看到原始 host
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host  $host;

        # 跨子域 cookie 必须透传
        proxy_cookie_flags ~ HttpOnly SameSite=Lax Secure;

        proxy_http_version 1.1;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
    }
}
```

```bash
nginx -t && systemctl reload nginx
```

---

## 5. 环境变量

### 5.1 Next.js `.env` (在 `/root/portal/.env`)

```bash
# === Database ===
DATABASE_URL="file:/data/dev.db"

# === NextAuth.js ===
AUTH_SECRET="$(openssl rand -base64 32)"     # 一次性生成, 之后别改
AUTH_TRUST_HOST="true"
NEXTAUTH_URL="https://me.xujianfei.cn"       # 门户主域

# === App ===
NEXT_PUBLIC_APP_NAME="我的导航"
NEXT_PUBLIC_APP_URL="https://me.xujianfei.cn"

# === 经期预测 (Flask 微服务) ===
PERIOD_API_URL="http://127.0.0.1:5001"       # 同一台机器走 localhost
PERIOD_SERVICE_SECRET="$(openssl rand -hex 32)"   # !!! 必须与 Flask 端一致
```

### 5.2 Flask `.env` (在 `/root/period-tracker/.env`)

```bash
FLASK_DEBUG=false
FLASK_HOST=127.0.0.1                          # !!! 不要 0.0.0.0, 不暴露公网
FLASK_PORT=5001
SECRET_KEY="$(openssl rand -hex 32)"          # Flask 内部用
DATABASE_URL="sqlite:////app/instance/period.db"

# !!! 关键: 与 Next.js 的 PERIOD_SERVICE_SECRET 一字不差
PERIOD_SERVICE_SECRET="$(上面那个)"

PERIOD_BRIDGE_SKEW_SECONDS=300
CORS_ORIGINS=                                # 留空 (server-to-server, 不需要 CORS)
```

校验一致:
```bash
# 在两台机器上各跑一次, 输出应完全相同
grep PERIOD_SERVICE_SECRET /root/portal/.env
grep PERIOD_SERVICE_SECRET /root/period-tracker/.env
```

---

## 6. 启动

### 6.1 Next.js (生产)

```bash
ssh root@114.215.182.68
cd /root/portal
pnpm install --frozen-lockfile
pnpm db:push
pnpm build

# systemd (推荐)
cat > /etc/systemd/system/portal.service << 'EOF'
[Unit]
Description=Personal Portal (Next.js)
After=network.target
[Service]
WorkingDirectory=/root/portal
EnvironmentFile=/root/portal/.env
ExecStart=/usr/bin/node node_modules/.bin/next start -p 3000
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now portal
systemctl status portal
```

### 6.2 Flask (生产)

```bash
ssh root@114.215.182.68
cd /root/period-tracker
docker compose up -d --build

# 验证 Flask 起来
docker ps | grep period
docker logs -f period-tracker-app

# 注意: 容器内端口 5001 已被映射到宿主机 127.0.0.1:5098 (见 period-tracker/docker-compose.yml)
# 如不想映射, 把 ports 段删了
```

---

## 7. 验证清单

按顺序跑, 全部应通过:

```bash
# 7.1 DNS 解析 (在 ECS 上)
dig +short me.xujianfei.cn        # → 114.215.182.68
dig +short period.xujianfei.cn    # → 114.215.182.68

# 7.2 Nginx 转发
curl -sI https://me.xujianfei.cn/                    # 200
curl -sI https://period.xujianfei.cn/                 # 200 (middleware 重写到 /period)

# 7.3 子域改写生效
curl -sL https://period.xujianfei.cn/ | grep -o "经期预测"   # 应找到

# 7.4 Flask HMAC 桥接
curl -i https://me.xujianfei.cn/api/period/demo/1     # 200 (demo 免鉴权)
curl -i https://me.xujianfei.cn/api/period/cycles      # 401 (无 session)

# 7.5 NextAuth 跨子域 cookie
# 浏览器打开 https://me.xujianfei.cn/signin 登录
# 检查 DevTools → Application → Cookies:
#   Domain 应是 .xujianfei.cn (含前导点)
# 然后切到 https://period.xujianfei.cn, 仍应是登录态
```

---

## 8. 排错速查

| 症状 | 原因 | 解决 |
|---|---|---|
| `period.xujianfei.cn` 跳到首页 | middleware 没匹配 / 没部署 | `pm2 logs` / `journalctl -u portal` 看 `x-portal-host` 是否设了 |
| 子域登录后跳回就掉登录 | cookie domain 没设到 `.xujianfei.cn` | 检查 `auth.ts` 里 `rootDomain()` 解析; `NEXTAUTH_URL` 必须用 `https://` |
| `/api/period/*` 在子域返回 404 | middleware 把 API 路径也改写了 | 检查 `PASS_THROUGH_PREFIXES` 是否含 `/api/` |
| Flask 502 | Flask 容器没起 / `PERIOD_SERVICE_SECRET` 不一致 | `docker ps` / 两边 `grep` 比对 |
| 跨子域 cookie 在 Safari 不通 | `SameSite=None` 没 `Secure` | NextAuth 默认 Lax, 没问题; 若改 None 必须 HTTPS |
| HTTPS 证书过期 | 宝塔自动续期 / acme.sh cron | `acme.sh --list` 看到期日 |

---

## 9. 后续扩展 (按需)

- 把 `me.` 也加 nginx 反代, 启用 HTTP/2
- `me.xujianfei.cn` 部署 Cloudflare CDN (改 A 为 CNAME)
- 多个子域 (比如 `blog.xujianfei.cn`) 时, 在 middleware 的 `PERIOD_PREFIXES` 同位置加映射表
- 迁移到 Postgres: 改 `DATABASE_URL`, 加 `postgres` 容器 (compose 已有注释段)

---

## 附录 A: 云盘子域 `pan.xujianfei.cn` (M1, 2026-06)

云盘是 2026-06-16 加的第三个子域, **沿用 Next.js + middleware 模式**, 跟 period 共用同一份 Next.js.

### 1. DNS 解析

阿里云 DNS 控制台 → `xujianfei.cn` → 添加记录:

| 主机记录 | 记录类型 | 记录值 | TTL |
|---|---|---|---|
| `pan` | A | `114.215.182.68` | 600 |

### 2. 申请证书 (覆盖 SAN)

```bash
# acme.sh 已部署在 ECS, 沿用现有脚本
ssh root@114.215.182.68
acme.sh --issue -d xujianfei.cn -d me.xujianfei.cn -d period.xujianfei.cn -d pan.xujianfei.cn --dns dns_ali
acme.sh --install-cert -d xujianfei.cn \
  --cert-file /path/to/cert.pem \
  --key-file  /path/to/key.pem \
  --fullchain-file /path/to/fullchain.pem \
  --reloadcmd "nginx -s reload"
```

### 3. 宝塔 nginx vhost

复制 `period.xujianfei.cn.conf` 为 `pan.xujianfei.cn.conf`, 改:
- `server_name pan.xujianfei.cn;`
- 验证 `proxy_set_header Host $host;` 在
- 验证 `proxy_cache off;` 在 server block 内(避开宝塔全局 `proxy_cache cache_one`)

```bash
scp 单文件: scp "/www/server/panel/vhost/nginx/period.xujianfei.cn.conf" 拉到本地, 改 server_name, 再 scp 上去
# 注意: 见 scp gotcha — 单文件 scp, 不要同时传多个文件
ssh root@114.215.182.68 "nginx -t && nginx -s reload"
```

### 4. ECS 准备工作

```bash
# 创建云盘存储目录 (next-server 用 www 用户跑)
mkdir -p /www/pan_data
chown -R www:www /www/pan_data
chmod 755 /www/pan_data

# .env 加 STORAGE_DRIVER 和 STORAGE_ROOT
echo 'STORAGE_DRIVER="local"' >> /www/wwwroot/xujianfei.cn/.env
echo 'STORAGE_ROOT="/www/pan_data"' >> /www/wwwroot/xujianfei.cn/.env
```

### 5. 部署 Next.js 改动 (沿用 memory 部署流程)

```bash
# 本地: 单文件 scp (不要 scp a b c dir/)
scp src/middleware.ts root@114.215.182.68:/www/wwwroot/xujianfei.cn/src/middleware.ts
scp src/lib/portal-url.ts root@114.215.182.68:/www/wwwroot/xujianfei.cn/src/lib/portal-url.ts
# ... 其他新文件 (app/pan/*, app/api/pan/*, lib/storage/*, lib/pan-*.ts, components/pan/*)
# 最后 scp 修改的 schema.prisma + 整个 prisma/migrations/20260616174216_add_pan_files/

# ECS 上
ssh root@114.215.182.68
cd /www/wwwroot/xujianfei.cn
pnpm install                          # 装新依赖
pnpm prisma migrate deploy            # 应用 pan_files 迁移
pnpm build                            # ~3 分钟, 高峰 OOM 见 ecs-lowmem-oom memory
ps -ef | grep next-server | grep -v grep | awk '{print $2}' | xargs -r kill
nohup sudo -u www /usr/local/bin/pnpm start > /var/log/next-portal.log 2>&1 &
curl -I http://127.0.0.1:3000/        # 200 = OK
```

### 6. 上线首页卡片

```bash
# 上线 pan 卡片 url (从 dev/null → pan.xujianfei.cn, dev → online)
cd /www/wwwroot/xujianfei.cn
node scripts/fix-pan-url.mjs
```

### 7. 验证

```bash
curl -I https://pan.xujianfei.cn/  # 期望 200 或 302 (未登录)
# 浏览器登录后: 看到文件浏览器, 共享池入口
# 个人门户 https://me.xujianfei.cn/ 首页: 看到"私有云盘"卡片 (online)
```
