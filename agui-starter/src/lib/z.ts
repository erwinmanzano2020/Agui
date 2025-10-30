/**
 * Central Zod facade.
 * Always import from here:
 *   import { z, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * IMPORTANT: We must re-export the NAMED `z` binding from "zod",
 * NOT a module namespace. Turbopack SSR can break if we wrap the namespace.
 */

import {
  z as _z,
  ZodIssueCode,
  type ZodType,
  type ZodIssue,
  type ZodString,
  type ZodNumber,
  type ZodBoolean,
  type ZodObject,
  type ZodArray,
  type ZodEnum,
  type RefinementCtx,
} from "zod";

// Minimal runtime sanity check (dev/build)
if (
  !_z ||
  typeof _z.object !== "function" ||
  typeof _z.string !== "function" ||
  typeof _z.enum !== "function"
) {
  throw new Error("[ZOD_IMPORT_BROKEN] z appears invalid in src/lib/z.ts");
}

// Re-export the actual `z` value
export const z = _z;

// Re-export commonly used items so callers never import from "zod" directly
export { ZodIssueCode };
export type {
  ZodType,
  ZodIssue,
  ZodString,
  ZodNumber,
  ZodBoolean,
  ZodObject,
  ZodArray,
  ZodEnum,
  RefinementCtx,
};
