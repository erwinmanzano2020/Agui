import { readdir } from "node:fs/promises";
import path from "node:path";

const appDir = path.resolve("src/app");

const routeFilePattern = /\/(page|route)\.(ts|tsx|js|jsx)$/;

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await collectFiles(fullPath)));
    } else if (routeFilePattern.test(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function normalizeRoute(filePath) {
  let route = path.relative(appDir, filePath).replace(/\\/g, "/");

  // Remove route groups, parallel routes, and optional catchall markers from segments
  route = route
    .split("/")
    .filter((segment) => segment && !segment.startsWith("@"))
    .map((segment) => (segment.startsWith("(") && segment.endsWith(")") ? null : segment))
    .filter((segment) => segment !== null)
    .join("/");

  route = route.replace(/\/(page|route)\.(ts|tsx|js|jsx)$/, "");

  if (!route || route === ".") {
    return "/";
  }

  return `/${route}`.replace(/\/+/g, "/");
}

async function main() {
  const files = await collectFiles(appDir);
  const collisions = new Map();

  for (const file of files) {
    const route = normalizeRoute(file);
    const existing = collisions.get(route);
    if (existing) {
      existing.push(file);
    } else {
      collisions.set(route, [file]);
    }
  }

  let hasCollision = false;

  for (const [route, filesForRoute] of collisions.entries()) {
    if (filesForRoute.length > 1) {
      hasCollision = true;
      console.error(`Route collision at "${route}":`);
      for (const file of filesForRoute) {
        console.error(`  - ${path.relative(process.cwd(), file)}`);
      }
    }
  }

  if (hasCollision) {
    process.exitCode = 1;
    return;
  }

  console.log("No route collisions detected.");
}

main().catch((error) => {
  console.error("Failed to check routes:", error);
  process.exitCode = 1;
});
