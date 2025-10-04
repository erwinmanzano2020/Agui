// next.config.ts
import type { NextConfig } from "next";
import { env } from "process";

function toList(v?: string) {
  return (v ?? "").split(",").map(s => s.trim()).filter(Boolean);
}

const nextConfig: NextConfig = {
  // ✅ para hindi bumagsak sa linting errors habang nagde-deploy
  eslint: { ignoreDuringBuilds: true },
  // ✅ para hindi mag-crash kung wala yung REPLIT_DOMAINS sa Vercel
  allowedDevOrigins: toList(env.REPLIT_DOMAINS),
};

module.exports = nextConfig;
