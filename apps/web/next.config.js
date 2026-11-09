/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow a separate build directory so a running production server does not
  // lock .next on Windows. CI and normal builds keep the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  async rewrites() {
    const proxyTarget =
      process.env.API_PROXY_URL || `http://localhost:${process.env.API_PORT || 3001}`;
    return [
      {
        source: '/api/:path*',
        destination: `${proxyTarget}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
