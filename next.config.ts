import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "@prisma/client", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
