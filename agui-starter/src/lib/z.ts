/**
 * Zod facade – import this *everywhere* instead of "zod":
 *   import { z, stringEnum, ZodIssueCode, type RefinementCtx } from "@/lib/z";
 *
 * This bypasses Turbopack/SSR ESM quirks by resolving Zod via Node's require.
 */

import type { ZodIssue } from "zod";
import { createRequire } from "module";

// Resolve the actual zod module using Node's resolver (avoids ESM namespace weirdness)
const req = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const ZNS: any = req("zod");

// Try common shapes: { z }, { default: { z } }, default itself, or the namespace
const candidates: any[] = [ZNS?.z, ZNS?.default?.z, ZNS?.default, ZNS];

function isZApi(o: any) {
  return (
    o &&
    typeof o.object === "function" &&
    typeof o.string === "function" &&
    typeof o.enum === "function"
  );
}

let _z: any = candidates.find(isZApi);

if (!_z) {
  const keys = ZNS && typeof ZNS === "object" ? Object.keys(ZNS).join(", ") : "(none)";
  throw new Error(`[ZOD_IMPORT_BROKEN] z appears invalid in src/lib/z.ts. Keys: ${keys}`);
}

// Runtime z API
export const z = _z as typeof import("zod")["z"];

// Constants/types — pull from whichever object has them
export const ZodIssueCode: typeof import("zod")["ZodIssueCode"] =
  ZNS.ZodIssueCode ?? ZNS?.default?.ZodIssueCode;

// Type re-exports
export type { ZodIssue };

/** Version-safe ctx type for .refine/.superRefine */
export type RefinementCtx = {
  addIssue: (issue: ZodIssue) => void;
};

/** Small helper for union of string literals */
export function stringEnum<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}
