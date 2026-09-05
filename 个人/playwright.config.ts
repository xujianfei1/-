import { defineConfig } from '@playwright/test';

/**
 * E2E 回归配置
 * 前置: 本地 dev server 运行于 localhost:3000 (pnpm dev), 测试账号已在库
 * 运行: pnpm e2e
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    locale: 'zh-CN',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
