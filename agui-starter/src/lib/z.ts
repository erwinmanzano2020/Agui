// src/lib/z.ts
import * as Z from "zod";

/**
 * Canonical Zod API export (preferred).
 *
 * Usage:
 *   import { z } from "@/lib/z";
 */
export const z = Z;

/** Default export for defensive compatibility (`import z from "@/lib/z"`). */
export default z;

/**
 * Re-export the entire Zod surface so namespace imports stay functional.
 */
export * from "zod";

/** Stable type aliases that continue working across Zod variants. */
export type ZodIssue = Z.ZodIssue;
export type ZodTypeAny = Z.ZodType<any>;
export type AnyZodObject = Z.ZodObject<any>;

/** Minimal structural ctx type for superRefine usage. */
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

type PortableIssue = { code?: unknown };
type PortableErrorMap = (
  issue: PortableIssue,
  ctx?: unknown
) => { message?: string };

const enumIssueCode = () =>
  (z as any).ZodIssueCode?.invalid_enum_value ?? "invalid_enum_value";

/** String enum helper with nicer errors that works across Zod builds. */
export const stringEnum = <T extends readonly [string, ...string[]]>(
  values: T,
  label?: string
) => {
  const expectedCode = enumIssueCode();
  const formattedList = values.join(", ");

  const errorMap: PortableErrorMap = (issue) => {
    if ((issue as any).code === expectedCode) {
      const message = label
        ? `${label} must be one of: ${formattedList}`
        : `Must be one of: ${formattedList}`;
      return { message };
    }
    return { message: "Invalid value" };
  };

  return z.enum(values, { errorMap }) as Z.ZodEnum<T>;
};
