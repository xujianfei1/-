import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: ['node_modules/', '.next/', 'tests/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // 'server-only' 是 Next.js 提供的 sentinel (在客户端 import 时会构建失败)
      // vitest 环境没有这个模块, 替换成空模块
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
