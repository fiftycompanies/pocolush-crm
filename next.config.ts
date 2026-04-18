import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['exceljs'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lhuaxmzsvrmjavanunnv.supabase.co',
        pathname: '/storage/v1/object/public/service-photos/**',
      },
    ],
  },
};

export default nextConfig;
