#!/usr/bin/env node

/**
 * Test runner contract (agui-starter):
 * - We compile TS tests into `.test-dist` first to keep Node's built-in `--test` runner
 *   operating on executable JS output.
 * - For scoped runs, we resolve file/dir targets under `.test-dist` and generate a
 *   manifest test file that imports those resolved test files. This avoids glob/path
 *   edge cases with dynamic route segments like `[slug]` and `[id]`.
 * - Supported invocation shapes:
 *   1) no targets => full suite
 *   2) one or more `src/...` (or `.test-dist/...`) file targets
 *   3) directory targets
 *   4) selected Node test flags before targets, including value-taking flags such as
 *      `--test-name-pattern <value>`.
 * - Known limitation: arbitrary/raw Node CLI shapes are not guaranteed; stick to the
 *   documented contract in `docs/engineering/debugging-playbook.md`.
 */

const { rmSync, mkdirSync, writeFileSync, statSync, readdirSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, ".test-dist");
const rawArgs = process.argv.slice(2);
const sharedNodeArgs = ["--require", "./scripts/register-test-aliases.cjs"];
const VALUE_FLAGS = new Set([
  "--test-name-pattern",
  "--test-skip-pattern",
  "--test-reporter",
  "--test-reporter-destination",
  "--test-timeout",
  "--test-concurrency",
  "--conditions",
  "-t",
]);
const { flags: cliFlags, targets: cliTargetsRaw } = parseCliArgs(rawArgs);
const cliTargets = cliTargetsRaw.map(mapToDistTarget);

rmSync(distDir, { recursive: true, force: true });
run("tsc", ["-p", "tsconfig.test.json"]);

if (cliTargets.length === 0) {
  run("node", ["--require", "../scripts/register-test-aliases.cjs", ...cliFlags, "--test"], distDir);
  process.exit(0);
}

const resolvedTestFiles = dedupe(cliTargets.flatMap(resolveTestFiles));
if (resolvedTestFiles.length === 0) {
  console.error("No tests resolved for the requested targets.");
  process.exit(1);
}

const scopedDir = path.join(distDir, ".scoped-tests");
mkdirSync(scopedDir, { recursive: true });
const manifestPath = path.join(scopedDir, "manifest.test.mjs");
const manifestSource = resolvedTestFiles
  .map((filePath) => toPosix(path.relative(scopedDir, filePath)))
  .map((relativePath) => `import ${JSON.stringify(relativePath.startsWith(".") ? relativePath : `./${relativePath}`)};`)
  .join("\n");

writeFileSync(manifestPath, `${manifestSource}\n`, "utf8");
run("node", [...sharedNodeArgs, ...cliFlags, "--test", toPosix(path.relative(rootDir, manifestPath))], rootDir);

function mapToDistTarget(target) {
  const normalized = target.replace(/\\/g, "/").replace(/^\.\//, "");
  const fromSrc = normalized.startsWith("src/") ? normalized.slice(4) : normalized;
  const prefixed = fromSrc.startsWith(".test-dist/") ? fromSrc : `.test-dist/${fromSrc}`;
  const withExt = prefixed.endsWith(".ts") ? `${prefixed.slice(0, -3)}.js` : prefixed;
  return path.resolve(rootDir, withExt);
}

function parseCliArgs(args) {
  const flags = [];
  const targets = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--") {
      targets.push(...args.slice(i + 1));
      break;
    }

    if (arg.startsWith("-")) {
      flags.push(arg);

      if (flagExpectsValue(arg)) {
        const next = args[i + 1];
        if (typeof next !== "string") {
          throw new Error(`Missing value for flag: ${arg}`);
        }
        flags.push(next);
        i += 1;
      }
      continue;
    }

    targets.push(arg);
  }

  return { flags, targets };
}

function flagExpectsValue(flag) {
  if (flag.includes("=")) return false;
  return VALUE_FLAGS.has(flag);
}

function resolveTestFiles(targetPath) {
  const info = safeStat(targetPath);
  if (!info) {
    throw new Error(`Target not found: ${path.relative(rootDir, targetPath)}`);
  }

  if (info.isFile()) {
    return targetPath.endsWith(".test.js") ? [targetPath] : [];
  }

  return walk(targetPath).filter((entry) => entry.endsWith(".test.js"));
}

function walk(dirPath) {
  const out = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(absolute));
    } else if (entry.isFile()) {
      out.push(absolute);
    }
  }
  return out;
}

function safeStat(filePath) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function run(command, args, cwd = rootDir) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
