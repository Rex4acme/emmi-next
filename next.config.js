/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enforce errors during build for safety
  typescript: {
    ignoreBuildErrors: false,
  },
  // Enforce linting during build
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
