/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for deployment under /client path
  basePath: '/client',
  assetPrefix: '/client',
  trailingSlash: true,
  output: 'export',
  distDir: 'out',
  images: {
    unoptimized: true
  },
  experimental: {
    optimizePackageImports: ['@firebase/app', '@firebase/auth', '@firebase/firestore']
  },
  // Ensure all public assets are prefixed correctly
  publicRuntimeConfig: {
    basePath: '/client'
  }
}

module.exports = nextConfig