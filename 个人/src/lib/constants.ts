/**
 * 应用常量
 */
export const APP_NAME = '我的导航';
export const APP_DESCRIPTION = '个人门户与导航中心';

export const SERVICE_STATUS_MAP = {
  online: { label: '在线',   variant: 'success' as const },
  dev:    { label: '开发中', variant: 'warning' as const },
  plan:   { label: '计划中', variant: 'info' as const },
  idea:   { label: '构思中', variant: 'muted' as const },
} as const;

export const API_BASE = '/api';
export const PAGINATION_DEFAULT = 20;
export const PAGINATION_MAX = 100;

// === 经期预测 (Flask 微服务) ===
// PERIOD_API_URL: Flask 容器地址. 开发用 127.0.0.1:5001; 容器内用 http://period-flask:5001
export const PERIOD_API_URL = process.env.PERIOD_API_URL ?? 'http://127.0.0.1:5001';
// PERIOD_SERVICE_SECRET: 与 Flask 共享的 HMAC 密钥. 仅 server side 使用.
export const PERIOD_SERVICE_SECRET = process.env.PERIOD_SERVICE_SECRET ?? '';
