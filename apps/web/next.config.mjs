/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs", "pg-boss", "svix"],
  },
};

export default nextConfig;
