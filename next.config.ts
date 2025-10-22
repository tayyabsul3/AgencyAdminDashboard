import type { NextConfig } from "next";

const nextConfig: NextConfig = {
 output: "export", // enable static export
  eslint: {
    ignoreDuringBuilds: true, // skip ESLint errors
  },
  typescript: {
    ignoreBuildErrors: true, // skip TypeScript errors
  },
  reactStrictMode: true, 
  images: { unoptimized: true },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;
