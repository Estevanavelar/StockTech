/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Output configuration
  output: 'standalone',
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002',
    NEXT_PUBLIC_AVADMIN_API_URL: process.env.NEXT_PUBLIC_AVADMIN_API_URL || 'http://localhost:8001',
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'StockTech',
  },
  
  // Image configuration
  images: {
    domains: ['localhost', 'app.avelarcompany.com.br', 'stocktech.avelarcompany.com.br'],
    unoptimized: true, // For Docker
  },
  
  // Redirects for app.avelarcompany.com.br/stocktech routing
  async rewrites() {
    return [
      {
        source: '/stocktech/:path*',
        destination: '/:path*',
      },
    ];
  },
  
  // Experimental features
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3002', 'app.avelarcompany.com.br']
    }
  },
};

module.exports = nextConfig;