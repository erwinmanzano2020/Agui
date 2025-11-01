#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const srcDir = path.resolve(projectRoot, "src");

if (process.env.ZOD_CHECK === "0") {
  console.log("⚠️  ZOD_CHECK=0 — skipping zod import check.");
  process.exit(0);
}

const facadePath = path.resolve(projectRoot, "src/lib/z.ts");

const schemaHints = [
  "z.object(",
  "z.enum(",
  "z.array(",
  "z.union(",
  "z.string(",
  "z.number(",
  "z.boolean(",
  "z.record(",
  "z.tuple(",
  "z.literal(",
  "z.discriminatedUnion(",
  "z.nativeEnum(",
  "z.set(",
  "z.map(",
  "z.intersection("
];

const typeOnlyImportRe = /import\s+type\s+(?:\*\s+as\s+z|\{[^}]*\bz\b[^}]*\})\s+from\s*[\"'](?:zod|@\/lib\/z)[\"'];?/;
const valueImportRe = /import\s*\{\s*z\s*\}\s*from\s*[\"'](?:zod|@\/lib\/z)[\"'];?/;
const namespaceImportRe = /import\s*\*\s+as\s+\w+\s*from\s*[\"'](?:zod|@\/lib\/z)[\"'];?/;
const riskyBarrelRe = /export\s+(?:\*\s+as\s+\w+|\{\s*z\s*\}|\*)\s+from\s*[\"']zod[\"']/;

const offenders = [];
const directImportOffenders = [];
const namespaceAccessOffenders = [];

const directZodImportRe = /from\s*["']zod["']/;
const namespaceAccessRe = /\bz\.z\./;

walkDir(srcDir, (filePath) => {
  if (path.resolve(filePath) === facadePath) return;
  if (!/\.(ts|tsx)$/.test(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  if (directZodImportRe.test(text)) {
    directImportOffenders.push(filePath);
  }
  if (namespaceAccessRe.test(text)) {
    namespaceAccessOffenders.push(filePath);
  }
  const buildsSchema = schemaHints.some((hint) => text.includes(hint));
  if (!buildsSchema) return;
  const hasNamespaceImport = namespaceImportRe.test(text);
  const hasValueImport = valueImportRe.test(text);
  const hasTypeOnlyImport = typeOnlyImportRe.test(text);

  if (hasTypeOnlyImport) {
    offenders.push({ filePath, message: "uses type-only zod import in a schema-building file" });
    return;
  }

  if (hasNamespaceImport) {
    offenders.push({
      filePath,
      message:
        "imports zod via `import * as …`; use `import { z } from \"@/lib/z\"` (or directly from \"zod\") instead",
    });
    return;
  }

  if (!hasValueImport) {
    offenders.push({
      filePath,
      message: "constructs zod schema but is missing `import { z } from \"@/lib/z\"`",
    });
  }
});

const barrelOffenders = [];
walkDir(projectRoot, (filePath) => {
  if (!/\.(ts|tsx)$/.test(filePath)) return;
  const isFacade = path.resolve(filePath) === facadePath;
  const text = fs.readFileSync(filePath, "utf8");
  if (!isFacade && directZodImportRe.test(text)) {
    directImportOffenders.push(filePath);
  }
  if (namespaceAccessRe.test(text)) {
    namespaceAccessOffenders.push(filePath);
  }
  if (!isFacade && riskyBarrelRe.test(text)) {
    barrelOffenders.push(filePath);
  }
});

const uniqueDirectImportOffenders = [...new Set(directImportOffenders)];
const uniqueNamespaceAccessOffenders = [...new Set(namespaceAccessOffenders)];

if (
  offenders.length ||
  barrelOffenders.length ||
  uniqueDirectImportOffenders.length ||
  uniqueNamespaceAccessOffenders.length
) {
  console.error("❌ Refusing to build due to unsafe zod imports.\n");
  if (offenders.length) {
    console.error("Files that must value-import zod:");
    for (const { filePath, message } of offenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)} → ${message}`);
    }
    console.error("");
  }
  if (uniqueDirectImportOffenders.length) {
    console.error("Files must import from \"@/lib/z\" instead of \"zod\":");
    for (const filePath of uniqueDirectImportOffenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)}`);
    }
    console.error("");
  }
  if (uniqueNamespaceAccessOffenders.length) {
    console.error("Replace \`z.z.*\` usage with the facade export (\`z.*\`):");
    for (const filePath of uniqueNamespaceAccessOffenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)}`);
    }
    console.error("");
  }
  if (barrelOffenders.length) {
    console.error("Barrels must not re-export zod values:");
    for (const filePath of barrelOffenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)}`);
    }
    console.error("\nFix: import { z } from \"@/lib/z\" (or directly from \"zod\") only at usage sites.");
  }
  process.exit(1);
}

console.log("✅ zod imports look good.");

function walkDir(dirPath, onFile) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath);
    }
  }
}
