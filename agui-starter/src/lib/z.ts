/**
 * Central Zod facade.
 * Always import `z` and supporting types from here:
 *   import { z, type RefinementCtx } from "@/lib/z";
 *
 * This avoids mixed ESM/CJS pitfalls under Turbopack/Vercel builds.
 */

import * as Z from "zod";
import type { ZodIssue } from "zod";

// Runtime guard so failures are loud & early in dev/build
const healthy =
  Z &&
  typeof Z.object === "function" &&
  typeof Z.string === "function" &&
  typeof Z.enum === "function";

if (!healthy) {
  throw new Error("[ZOD_IMPORT_BROKEN] z appears invalid in src/lib/z.ts");
}

// Re-export a concrete namespace that callers can rely on.
export const z = Z;

export type { ZodType, ZodIssue } from "zod";
export type RefinementCtx = { addIssue(issue: ZodIssue): void };
export { ZodIssueCode } from "zod";
