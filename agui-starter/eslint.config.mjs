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
              message: "Import Zod via the shared entrypoint: `import { Z } from \"@/lib/validation/zod\"`.",
            },
          ],
          patterns: [
            {
              group: ["@/**"],
              importNames: ["z", "Z"],
              message: "Do not import Zod bindings from internal barrels; use @/lib/validation/zod.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "z", "Z"],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value='zod']",
          message: "Import Zod via @/lib/validation/zod instead of directly from 'zod'.",
        },
        {
          selector: "CallExpression[callee.name='Z']",
          message: "Do not call Z as a function. Use helpers such as Z.string() or stringEnum().",
        },
        {
          selector: "VariableDeclarator[id.type='ObjectPattern'][init.name='Z']",
          message: "Do not destructure from Z. Call its methods directly.",
        },
      ],
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
          ],
          patterns: [
            {
              group: ["@/lib/*"],
              importNames: ["z"],
              message: "Do not import Zod bindings from internal libraries on this page.",
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
