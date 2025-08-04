/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // turbo: false, // This disables Turbopack and uses Webpack instead
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig; 