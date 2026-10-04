import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "@prisma/client", "bcryptjs", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
