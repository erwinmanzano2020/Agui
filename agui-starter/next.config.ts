// next.config.ts
import type { NextConfig } from "next";
import { env } from "process";

/** Helper: convert comma-separated env vars to clean array */
function toList(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Next.js configuration
 * Notes:
 * - eslint.ignoreDuringBuilds prevents CI deploy failures on lint warnings
 * - allowedDevOrigins allows safe local testing with REPLIT or custom domains
 * - turbopack.root silences "multiple lockfile" warnings in CI
 */
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  allowedDevOrigins: toList(env.REPLIT_DOMAINS),

  turbopack: {
    root: ".", // ✅ sets correct root for builds inside agui-starter/
  },
};

export default nextConfig;
