// src/lib/z.ts
import * as Z from "zod";

// Single import surface
export const z = Z;

/** Stable type aliases that work across Zod builds */
export type ZodIssue = Z.ZodIssue;
export type ZodTypeAny = Z.ZodType<any>;
export type AnyZodObject = Z.ZodObject<any>;

/** Minimal structural ctx type for superRefine */
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

/** A portable ZodErrorMap type via setErrorMap parameter */
type ZodErrorMap = Parameters<typeof z.setErrorMap>[0];

/** Create a string enum schema with a nicer error message. */
export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) => {
  const errorMap: ZodErrorMap = (issue) => {
    const code = (issue as any).code;
    const isEnumErr =
      code === (z as any).ZodIssueCode?.invalid_enum_value || code === "invalid_enum_value";

    if (isEnumErr) {
      const msg = label
        ? `${label} must be one of: ${values.join(", ")}`
        : `Must be one of: ${values.join(", ")}`;
      return { message: msg };
    }
    return { message: "Invalid value" };
  };

  return z.enum(values as unknown as [string, ...string[]], { errorMap });
};
