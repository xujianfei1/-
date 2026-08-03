/**
 * 从请求 host 反推门户主域 (apex).
 *
 * 已知子域 (period./pan.) → 拼成 apex URL:
 *   period.xujianfei.cn     → https://xujianfei.cn
 *   period.xujianfei.cn:443 → https://xujianfei.cn  (端口自动剥掉)
 *   pan.xujianfei.cn        → https://xujianfei.cn
 *
 * dev (period.test / pan.test):
 *   period.localhost        → https://localhost
 *   period.test             → https://test
 *
 * 同域 / 已 301 → null (不显示返回链接):
 *   xujianfei.cn / www.xujianfei.cn       (apex 本身)
 *   me.xujianfei.cn / me.test             (legacy 已 301 到 apex)
 *   localhost / *.localhost / IP / null
 */
export function portalUrlFor(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(':')[0] ?? '';

  // 已在 apex / 同域 / legacy me. / 裸 localhost / IP
  if (h === 'xujianfei.cn' || h === 'www.xujianfei.cn') return null;
  if (h === 'me.xujianfei.cn') return null;
  if (h === 'me.test') return null;
  if (h === 'localhost') return null;
  if (/^(\d+\.){3}\d+$/.test(h)) return null;

  // 已知子域 (period./pan.) → 剥前缀, 拼成 apex
  for (const prefix of ['period.', 'pan.']) {
    if (h.startsWith(prefix)) return `https://${h.slice(prefix.length)}`;
  }

  // 未知子域 (blog./price./xujianfei.cn 等) → null, 不误判
  return null;
}
