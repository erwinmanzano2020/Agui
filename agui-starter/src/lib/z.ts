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

/** Default export for defensive compatibility (`import z from "@/lib/z"`). */
export default z;

/**
 * Re-export the entire Zod surface so that
 *   import * as z from "@/lib/z"
 * also behaves like the native Zod namespace.
 */
export * from "zod";

/** Stable type aliases that continue working across Zod variants. */
export type ZodIssue = Z.ZodIssue;
export type ZodTypeAny = Z.ZodType<any, any, any>;
export type AnyZodObject = Z.ZodObject<any>;

/** Minimal structural ctx type for superRefine usage. */
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

type PortableIssue = { code?: unknown };
type PortableErrorMap = (issue: PortableIssue) => { message?: string };

/** String enum helper with nicer errors that works across Zod builds. */
export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) => {
  const errorMap: PortableErrorMap = (issue) => {
    const enumCode =
      (z as any).ZodIssueCode?.invalid_enum_value ?? "invalid_enum_value";
    if ((issue as any).code === enumCode) {
      const list = values.join(", ");
      return {
        message: label
          ? `${label} must be one of: ${list}`
          : `Must be one of: ${list}`,
      };
    }
    return { message: "Invalid value" };
  };

  return (z as any).enum(values as any, { errorMap }) as Z.ZodEnum<
    [string, ...string[]]
  >;
};
