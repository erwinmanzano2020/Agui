const Module = require("node:module");
const path = require("node:path");

const outDir = path.resolve(__dirname, "..", ".test-dist");
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    const mapped = path.join(outDir, request.slice(2));
    return originalResolveFilename.call(this, mapped, parent, isMain, options);
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};
