import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // 关闭 Next 内置响应压缩: Node 20.18 的 WHATWG Streams 不支持
  // controller[kState].transformAlgorithm, 启用会 500.
  // 改用 nginx (已开 gzip) 承担压缩.
  compress: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
