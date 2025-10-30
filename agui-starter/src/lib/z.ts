/**
 * Zod facade – always import from here:
 *   import { z, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * Keep exports minimal & version-safe. Do NOT re-export the entire module namespace.
 */

import {
  z as _z,
  ZodIssueCode,
  // Safe type exports across zod v3 variants:
  type RefinementCtx,
  type ZodIssue,
  type ZodTypeAny,
  type AnyZodObject,
} from "zod";

// Runtime sanity check (helps catch bundler/interop issues)
if (
  !_z ||
  typeof _z.object !== "function" ||
  typeof _z.string !== "function" ||
  typeof _z.enum !== "function"
) {
  throw new Error("[ZOD_IMPORT_BROKEN] z appears invalid in src/lib/z.ts");
}

// Re-export the actual `z` runtime
export const z = _z;

// Minimal helpers (optional, used by some routes)
export function stringEnum<T extends readonly [string, ...string[]]>(values: T) {
  // Note: message customization can be applied by callers via .superRefine if needed
  return _z.enum(values);
}

// Re-export a few commonly used items
export { ZodIssueCode };
export type { RefinementCtx, ZodIssue, ZodTypeAny, AnyZodObject };

