import type { NextConfig } from "next";

const config: NextConfig = {
  // Keep only one root config to avoid:
  // “Both `outputFileTracingRoot` and `turbopack.root` are set…”
  outputFileTracingRoot: process.cwd(),

  serverExternalPackages: ["zod"],
  env: {
    AGUI_TAXONOMY_V2: "true",
  },
  eslint: {
    // TODO(codex): Re-enable lint during build once PR #12.1 (Identity harden pass) lands.
    ignoreDuringBuilds: true,
  },
};

export default config;
