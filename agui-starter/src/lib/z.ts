import * as Z from "zod";

export const z = Z;

// common types (no version-specific named types)
export type ZodIssue = Z.ZodIssue;
export type ZodTypeAny = Z.ZodTypeAny;
export type AnyZodObject = Z.AnyZodObject;

// helpers
export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) =>
  Z.enum(values as unknown as [string, ...string[]], {
    errorMap: (issue) => {
      if (issue.code === "invalid_enum_value") {
        return {
          message:
            label
              ? `${label} must be one of: ${values.join(", ")}`
              : `Must be one of: ${values.join(", ")}`,
        };
      }
      return { message: "Invalid value" };
    },
  });

export type RefinementCtx = {
  addIssue: (issue: ZodIssue) => void;
};
