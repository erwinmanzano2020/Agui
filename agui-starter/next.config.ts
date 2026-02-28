import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep only one root config to avoid:
  // “Both `outputFileTracingRoot` and `turbopack.root` are set…”
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/*": ["./node_modules/qrcode/**"],
  },
  env: {
    AGUI_TAXONOMY_V2: "true",
  },
  eslint: {
    // TODO(codex): Re-enable lint during build once PR #12.1 (Identity harden pass) lands.
    ignoreDuringBuilds: true,
  },
  experimental: {
    turbo: {
      resolveAlias: {
        zod: path.resolve(__dirname, "src/lib/zod-shim.ts"),
      },
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      zod: path.resolve(__dirname, "src/lib/zod-shim.ts"),
    };

    return config;
  },
};

export default nextConfig;
