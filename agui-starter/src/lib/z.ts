import * as Z from "zod";

// Single import surface
export const z = Z;

// ---- Stable type aliases (work across Zod 3 variants) ----
export type ZodIssue = Z.ZodIssue;
// Use the generic base types instead of version-specific aliases
export type ZodTypeAny = Z.ZodType<any, any, any>;
export type AnyZodObject = Z.ZodObject<any>;

// ---- Helpers ----
/**
 * Create a string enum schema with a nicer error message.
 * Works for both classic and vendored Zod builds.
 */
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

export type RefinementCtx = Parameters<NonNullable<Z.ZodTypeAny["_def"]["errorMap"]>>[0];
