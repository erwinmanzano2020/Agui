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

const typeOnlyImportRe = /import\s+type\s+(?:\*\s+as\s+z|\{[^}]*\bz\b[^}]*\})\s+from\s+[\"']zod[\"'];?/;
const valueImportRe = /import\s*\{\s*z\s*\}\s*from\s*[\"']zod[\"'];?/;
const namespaceImportRe = /import\s*\*\s+as\s+z\s*from\s*[\"']zod[\"'];?/;
const riskyBarrelRe = /export\s+(?:\*\s+as\s+z|\{\s*z\s*\}|\*)\s+from\s*[\"']zod[\"']/;

const offenders = [];

walkDir(srcDir, (filePath) => {
  if (!/\.(ts|tsx)$/.test(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  const buildsSchema = schemaHints.some((hint) => text.includes(hint));
  if (!buildsSchema) return;
  const hasValueImport = valueImportRe.test(text) || namespaceImportRe.test(text);
  const hasTypeOnlyImport = typeOnlyImportRe.test(text);

  if (hasTypeOnlyImport) {
    offenders.push({ filePath, message: "uses type-only zod import in a schema-building file" });
    return;
  }

  if (!hasValueImport) {
    offenders.push({ filePath, message: "constructs zod schema but is missing `import { z } from \"zod\"`" });
  }
});

const barrelOffenders = [];
walkDir(projectRoot, (filePath) => {
  if (!/\.(ts|tsx)$/.test(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  if (riskyBarrelRe.test(text)) {
    barrelOffenders.push(filePath);
  }
});

if (offenders.length || barrelOffenders.length) {
  console.error("❌ Refusing to build due to unsafe zod imports.\n");
  if (offenders.length) {
    console.error("Files that must value-import zod:");
    for (const { filePath, message } of offenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)} → ${message}`);
    }
    console.error("");
  }
  if (barrelOffenders.length) {
    console.error("Barrels must not re-export zod values:");
    for (const filePath of barrelOffenders) {
      console.error(`  - ${path.relative(projectRoot, filePath)}`);
    }
    console.error("\nFix: import { z } from \"zod\" only at usage sites.");
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
