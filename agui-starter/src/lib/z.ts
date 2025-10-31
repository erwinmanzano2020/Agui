// src/lib/z.ts
import * as Z from "zod";

/**
 * Canonical Zod API export (preferred)
 *
 * Usage:
 *   import { z } from "@/lib/z";
 *   const S = z.object({ ... });
 */
export const z = Z;

/**
 * Default export for defensive compatibility.
 *
 * Usage (still works):
 *   import z from "@/lib/z";
 *   z.object({ ... });
 */
export default z;

/**
 * Re-export the entire Zod surface so that
 *   import * as z from "@/lib/z"
 * also behaves like the Zod namespace:
 *
 * Usage (legacy code still compiles):
 *   import * as z from "@/lib/z";
 *   z.object({ ... });
 */
export * from "zod";

// ---- Optional helper: stringEnum with nicer errors ----
type PortableIssue = { code?: unknown };
type PortableErrorMap = (issue: PortableIssue) => { message?: string };

export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) => {
  const errorMap: PortableErrorMap = (issue) => {
    // Try to match both vendored and regular Zod enum error codes
    const enumCode =
      (z as any).ZodIssueCode?.invalid_enum_value ?? "invalid_enum_value";
    if ((issue as any).code === enumCode) {
      const list = values.join(", ");
      return { message: label ? `${label} must be one of: ${list}` : `Must be one of: ${list}` };
    }
    return { message: "Invalid value" };
  };

  return (z as any).enum(values as any, { errorMap }) as Z.ZodEnum<
    [string, ...string[]]
  >;
};
