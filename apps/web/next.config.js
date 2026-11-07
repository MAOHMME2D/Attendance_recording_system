/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow a separate build directory so a running production server does not
  // lock .next on Windows. CI and normal builds keep the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.API_PORT || 3001}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
