// src/lib/z.ts
import { z } from "zod";
import type { AnyZodObject, ZodEnum, ZodIssue, ZodTypeAny } from "zod";

/**
 * Canonical Zod API export (preferred).
 *
 * Usage:
 *   import { z } from "@/lib/z";
 */
export { z };

/** Default export for defensive compatibility (`import z from "@/lib/z"`). */
export default z;

/**
 * Re-export the entire Zod surface so namespace imports stay functional.
 */
export * from "zod";

/** Stable type aliases that continue working across Zod variants. */
export type { ZodIssue, ZodTypeAny, AnyZodObject };

/** Minimal structural ctx type for superRefine usage. */
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

type PortableIssue = { code?: unknown };
type PortableErrorMap = (
  issue: PortableIssue,
  ctx?: unknown
) => { message: string };

type ZodIssueCarrier = { ZodIssueCode?: { invalid_enum_value?: string } };

const enumIssueCode = () => {
  const issueCode = (z as ZodIssueCarrier).ZodIssueCode?.invalid_enum_value;
  return issueCode ?? "invalid_enum_value";
};

/** String enum helper with nicer errors that works across Zod builds. */
type MutableEnumValues<T extends readonly [string, ...string[]]> = {
  -readonly [Index in keyof T]: T[Index];
} & [string, ...string[]];

export const stringEnum = <const T extends readonly [string, ...string[]]>(
  values: T,
  label?: string
) => {
  const expectedCode = enumIssueCode();
  const formattedList = values.join(", ");

  const errorMap: PortableErrorMap = (issue) => {
    if (typeof issue.code === "string" && issue.code === expectedCode) {
      const message = label
        ? `${label} must be one of: ${formattedList}`
        : `Must be one of: ${formattedList}`;
      return { message };
    }
    return { message: "Invalid value" };
  };

  const mutableValues = [...values] as MutableEnumValues<T>;

  return z.enum(mutableValues, { errorMap }) as ZodEnum<MutableEnumValues<T>>;
};
