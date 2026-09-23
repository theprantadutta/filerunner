import path from "node:path";
import type { NextConfig } from "next";

// Pin the project root so a lockfile elsewhere in the repo isn't mistaken for the workspace root
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  // Set basePath for subpath deployments (e.g., /filerunner-next)
  // Leave empty or remove for root path deployments
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // assetPrefix must match basePath for static assets to load correctly
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
};

export default nextConfig;
