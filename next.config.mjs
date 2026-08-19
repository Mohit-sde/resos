/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    esmExternals: 'loose',
  },

  transpilePackages: [
    'firebase-admin',
    'firebase-admin/app',
    'firebase-admin/firestore', 
    'firebase-admin/auth',
    'jwks-rsa',
    'jose',
  ],

  reactStrictMode: true,
};

export default nextConfig;
