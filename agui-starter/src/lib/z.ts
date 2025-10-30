/**
 * Zod facade – always import from here:
 *   import { z, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * Keep exports minimal & version-safe. Do NOT re-export the entire module namespace.
 */

import {
  z as _z,
  ZodIssueCode,
  // These are stable across zod v3 variants; if they ever drift, drop them.
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

/**
 * Version-safe ctx type for .refine/.superRefine callbacks.
 * Only model the bit we use (addIssue) so this stays compatible across Zod versions.
 */
export type RefinementCtx = {
  addIssue: (issue: {
    code: unknown;
    message?: string;
    path?: (string | number)[];
    [key: string]: unknown;
  }) => void;
};

// Helper: string enum (kept tiny and zod-version-agnostic)
export function stringEnum<T extends readonly [string, ...string[]]>(values: T) {
  return _z.enum(values);
}

export { ZodIssueCode };
export type { ZodIssue, ZodTypeAny, AnyZodObject };
