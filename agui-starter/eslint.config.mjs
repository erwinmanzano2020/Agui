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
              message: "Use \"@/lib/z\" facade instead.",
            },
            {
              name: "zod",
              importNames: ["default"],
              message: "Use `import { z } from \"zod\"` instead of the default export.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportDeclaration[source.value='zod'][importKind!='type'] ImportSpecifier:not([imported.name='z'])",
          message: "Only `import { z } from \"zod\"` is allowed for runtime usage.",
        },
        {
          selector:
            "ImportDeclaration[source.value='zod'][importKind!='type'] ImportSpecifier[imported.name='z'][local.name!='z']",
          message: "Do not alias the `z` import; use `import { z } from \"zod\"`.",
        },
        {
          selector:
            "ImportDeclaration[source.value='zod'][importKind!='type'] ImportNamespaceSpecifier",
          message: "Do not use `import * as … from \"zod\"`. Use `import { z } from \"zod\"`.",
        },
        {
          selector:
            "VariableDeclaration:has(CallExpression[callee.name='require'][arguments.0.value='zod'])",
          message: "Do not require('zod'); use ESM value imports instead.",
        },
        {
          selector: "ImportDeclaration[source.value='zod'] ImportDefaultSpecifier",
          message: "Zod has no default export. Use `import { z } from \"zod\"`.",
        },
        {
          selector: "CallExpression[callee.name='Z']",
          message:
            "Use the lowercase `z` namespace returned by `import { z } from \"zod\"`.",
        },
        {
          selector: "VariableDeclarator[id.type='ObjectPattern'][init.name='z']",
          message:
            "Avoid destructuring from the `z` namespace; call helpers like z.string() directly.",
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
      ],
    },
  },
  {
    files: ["src/lib/z.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
];

export default eslintConfig;
