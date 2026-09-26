import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Invoices and payment receipts are capped at 4 MB (Vercel's request limit is 4.5 MB).
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
