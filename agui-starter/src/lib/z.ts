/**
 * Zod facade – always import from here:
 *   import { z, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * Keep exports minimal & version-safe. Do NOT re-export the entire module namespace.
 */

import {
  z as _z,
  ZodIssueCode,
  // stable types we use in app code
  type ZodIssue,
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

/**
 * Version-safe ctx type for .refine/.superRefine callbacks.
 * Accept both the classic ZodIssue signature and more permissive issue shapes.
 */
export type RefinementCtx = {
  addIssue: (issue: ZodIssue | { [k: string]: unknown }) => void;
};

// Helper: string enum (kept tiny and zod-version-agnostic)
export function stringEnum<T extends readonly [string, ...string[]]>(values: T) {
  return _z.enum(values);
}

export { ZodIssueCode };
export type { ZodIssue };
