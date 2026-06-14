import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow development HMR from local IP addresses
  allowedDevOrigins: ['192.168.0.26', 'localhost', '127.0.0.1'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
};

export default nextConfig;
