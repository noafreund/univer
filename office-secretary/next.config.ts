import path from 'node:path';
import type { NextConfig } from 'next';

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // This app lives inside a bigger repository; keep Next.js scoped to this folder.
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
