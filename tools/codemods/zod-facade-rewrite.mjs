// node tools/codemods/zod-facade-rewrite.mjs src
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2] || "src";
const files = [];

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      if (fullPath.endsWith(`${path.sep}lib${path.sep}z.ts`)) continue;
      files.push(fullPath);
    }
  }
};

walk(root);

for (const f of files) {
  const s = readFileSync(f, "utf8");
  if (!/from\s+["']zod["']/.test(s)) continue;

  let out = s
    // value import: import { z } from "zod"
    .replace(/import\s*\{\s*z\s*\}\s*from\s*["']zod["'];?/g, `import { z } from "@/lib/z";`)
    // type imports: import type { ... } from "zod"
    .replace(
      /import\s+type\s*\{\s*([^}]+)\}\s*from\s*["']zod["'];?/g,
      `import type {$1} from "@/lib/z";`
    ) // types reexported by facade’s default
    // fallbacks: import * as zod from "zod"
    .replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s*["']zod["'];?/g,
      `import { z as $1 } from "@/lib/z";`
    )
    // plain: import Z from "zod"
    .replace(/import\s+(\w+)\s+from\s*["']zod["'];?/g, `import { z as $1 } from "@/lib/z";`)
    // grouped with zod
    .replace(
      /(import\s*\{[^}]*),\s*z\s*(,[^}]*\}\s*from\s*["']zod["'];?)/g,
      `$1$2`
    ); // remove stray z
  if (out !== s) writeFileSync(f, out);
}

console.log("Codemod done.");
