// src/lib/z.ts
import * as Z from "zod";

// Single import surface
export const z = Z;

// ---- Stable type aliases that work across Zod builds ----
export type ZodIssue = Z.ZodIssue;

// In some vendored builds, ZodType is generic with ONE arg.
// Keep it super loose to avoid arity mismatches.
export type ZodTypeAny = Z.ZodType<any>;

// Same idea for ZodObject; keep parameters minimal for portability.
export type AnyZodObject = Z.ZodObject<any>;

// A minimal structural type for ctx used in superRefine.
// (Avoids depending on internal/export-variant names.)
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

// ---- Helpers ----
/** Create a string enum schema with a nicer error message. */
export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) =>
  z.enum(values as unknown as [string, ...string[]], {
    errorMap: (issue) => {
      if (issue.code === "invalid_enum_value") {
        const msg = label
          ? `${label} must be one of: ${values.join(", ")}`
          : `Must be one of: ${values.join(", ")}`;
        return { message: msg };
      }
      return { message: "Invalid value" };
    },
  });
