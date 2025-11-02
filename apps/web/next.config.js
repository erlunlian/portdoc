/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Handle canvas for react-pdf
    config.resolve.alias.canvas = false;
    return config;
  },
  transpilePackages: ["@repo/ui", "@repo/types"],
};

module.exports = nextConfig;

