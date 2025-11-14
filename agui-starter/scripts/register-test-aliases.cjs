const Module = require("node:module");
const path = require("node:path");

const outDir = path.resolve(__dirname, "..", ".test-dist");
const serverOnlyShim = path.resolve(__dirname, "stubs", "server-only.cjs");
const nextCacheShim = path.resolve(__dirname, "stubs", "next-cache.cjs");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(outDir, request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  if (request === "server-only") {
    return originalResolveFilename.call(this, serverOnlyShim, parent, isMain, options);
  }
  if (request === "next/cache") {
    return originalResolveFilename.call(this, nextCacheShim, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
