/**
 * Zod facade – always import from here:
 *   import { z, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * Goal: be resilient to Turbopack/SSR ESM interop quirks.
 */

import * as ZNS from "zod";

/** Try all known export shapes: `z`, `default`, or the namespace itself */
const _candidate =
  // e.g. normal ESM export { z }
  (ZNS as any)?.z ??
  // e.g. default export (some bundlers)
  (ZNS as any)?.default?.z ??
  // rare: default is already the `z` api
  (ZNS as any)?.default ??
  // final fallback (namespace) — works if it already *is* the `z` api
  (ZNS as any);

/** Narrow: we want an object that has z.object / z.string / z.enum functions */
function isValidZ(o: any) {
  return (
    o &&
    typeof o.object === "function" &&
    typeof o.string === "function" &&
    typeof o.enum === "function"
  );
}

/** If the first guess isn't valid, try a few more defensive unwraps */
let _z: any = _candidate;
if (!isValidZ(_z)) {
  // Some builds expose { z: { ...actual api... } }, others nest it differently.
  _z =
    (ZNS as any)?.default?.z ??
    (ZNS as any)?.z ??
    (ZNS as any)?.Z ?? // hypothetical
    _z;
}

if (!isValidZ(_z)) {
  const keys =
    _z && typeof _z === "object"
      ? Object.keys(_z).join(", ")
      : "(none)";
  throw new Error(`[ZOD_IMPORT_BROKEN] z appears invalid in src/lib/z.ts. Keys: ${keys}`);
}

/** Re-export the *runtime* z */
export const z = _z as typeof import("zod")["z"];

/* ---------------- Types & constants (safe across minor variants) ---------------- */

export { ZodIssueCode } from "zod";
export type { ZodIssue } from "zod";

/**
 * Version-safe ctx type for .refine/.superRefine callbacks.
 * Mirrors the actual context type by inferring from the runtime API.
 */
type SuperRefineCtx = Parameters<
  Parameters<ReturnType<typeof z.object>["superRefine"]>[0]
>[1];

export type RefinementCtx = SuperRefineCtx;

/** Tiny helper: string enum */
export function stringEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}
