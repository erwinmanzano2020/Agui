import type { NextConfig } from "next";
import { env } from "process";

function toList(v?: string) {
  return (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: toList(env.REPLIT_DOMAINS),
};

module.exports = nextConfig;
