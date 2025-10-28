import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message:
                "Do not import zod at module scope in app/**. Use loadZod() inside handlers or components.",
            },
            {
              name: "@/lib/index",
              message: "Avoid barrels that may execute schemas at module scope.",
            },
          ],
          patterns: ["@/lib/**/schema*", "@/lib/**/schemas*"],
        },
      ],
    },
  },
  {
    files: ["src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: "Use loadZod() inside API route handlers to avoid module-scope execution.",
            },
          ],
          patterns: ["@/lib/**/schema*", "@/lib/**/schemas*"],
        },
      ],
    },
  },
  {
    files: ["src/app/company/[slug]/patron-pass/page.tsx"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "zod", message: "Do not import zod in this SSR page. Use runtime guards or dynamic import." },
          { name: "@/lib/index", message: "Avoid barrel imports that may execute schemas at module scope." }
        ],
        patterns: ["@/lib/**/schema*", "@/lib/**/schemas*"]
      }]
    }
  },
];

export default eslintConfig;
