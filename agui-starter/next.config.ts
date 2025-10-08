// agui-starter/next.config.ts
import type { NextConfig } from "next";
import { env } from "process";
import path from "path";

function toList(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  allowedDevOrigins: toList(env.REPLIT_DOMAINS),
  turbopack: {
    root: path.join(__dirname), // absolute path to agui-starter
  },
};

export default nextConfig;
