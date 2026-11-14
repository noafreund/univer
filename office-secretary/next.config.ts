import path from 'node:path';
import type { NextConfig } from 'next';

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This app lives inside a bigger repository; keep Next.js scoped to this folder.
  turbopack: { root },
  outputFileTracingRoot: root,
  // Allow attaching files (protocols, PDFs) and uploading a backup for restore.
  experimental: { serverActions: { bodySizeLimit: '60mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
