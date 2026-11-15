import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure App Service runs a self-contained server (scripts/build-azure.sh, D29); a plain `next build` stays a normal build.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
};

export default nextConfig;
