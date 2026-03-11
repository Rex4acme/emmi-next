/** @type {import('next').NextConfig} */
// next.config.js — Next.js configuration
// images.domains allows loading images from Supabase storage URLs
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co', // Allow Supabase storage image URLs
      },
    ],
  },
};

module.exports = nextConfig;
