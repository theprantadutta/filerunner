import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Set basePath for subpath deployments (e.g., /filerunner-next)
  // Leave empty or remove for root path deployments
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // assetPrefix must match basePath for static assets to load correctly
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
