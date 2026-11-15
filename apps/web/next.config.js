/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Allow a separate build directory so a running production server does not
  // lock .next on Windows. CI and normal builds keep the default.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  async rewrites() {
    // Production deployments default to the Railway backend so the site works
    // without extra env configuration; local development falls back to localhost.
    // API_PROXY_URL always wins when explicitly set.
    const proxyTarget =
      process.env.API_PROXY_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://attendanceapi-production-8b4e.up.railway.app'
        : `http://localhost:${process.env.API_PORT || 3001}`);
    return [
      {
        source: '/api/:path*',
        destination: `${proxyTarget}/api/:path*`,
      },
      // Same-origin WebSocket path. Platforms that support upgrade proxying
      // (self-hosted / local dev) deliver realtime events; elsewhere the UI
      // falls back to polling. Never point the socket at a different host than
      // the page: the HttpOnly session cookie is host-scoped.
      {
        source: '/socket.io/:path*',
        destination: `${proxyTarget}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
