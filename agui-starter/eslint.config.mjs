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
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              importNames: ["default"],
              message: "Do not default-import Zod. Use `import { z as Z } from \"zod\"`.",
            },
            {
              name: "@/lib/schema-helpers",
              importNames: ["z"],
              message: "Do not import `z` from helpers; use `import { z as Z } from \"zod\"`.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/**"],
              importNames: ["z"],
              message: "Never import `z` from internal libraries; use the canonical Zod namespace.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "z"],
    },
  },
  {
    files: ["src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/index",
              message: "Avoid barrels that may execute schemas at module scope.",
            },
            {
              name: "@/lib/schema-helpers",
              importNames: ["z"],
              message: "Do not import `z` from helpers; use the real Zod namespace.",
            },
          ],
          patterns: [],
        },
      ],
    },
  },
  {
    files: ["src/app/company/[slug]/patron-pass/page.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "zod",
              message: "Do not import zod in this SSR page. Use runtime guards or dynamic import.",
            },
            {
              name: "@/lib/index",
              message: "Avoid barrel imports that may execute schemas at module scope.",
            },
            {
              name: "@/lib/schema-helpers",
              importNames: ["z"],
              message: "Do not import `z` from helpers; use the real Zod namespace.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/*"],
              importNames: ["z"],
              message: "Do not import `z` from internal libraries; use the real Zod namespace.",
            },
            "@/lib/**/schema*",
            "@/lib/**/schemas*",
          ],
        },
      ]
    }
  },
];

export default eslintConfig;
