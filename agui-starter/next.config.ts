import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep only one root config to avoid: 
  // “Both `outputFileTracingRoot` and `turbopack.root` are set…”
  outputFileTracingRoot: process.cwd(),

  experimental: {
    // If you MUST set turbopack.root, ensure it matches:
    // turbopack: { root: process.cwd() },
  },
};

export default config;
