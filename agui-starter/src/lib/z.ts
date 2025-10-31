// src/lib/z.ts
import * as Z from "zod";

/** Single import surface */
export const z = Z;

/** Stable type aliases that work across Zod variants */
export type ZodIssue = Z.ZodIssue;
export type ZodTypeAny = Z.ZodType<any>;
export type AnyZodObject = Z.ZodObject<any>;

/** Minimal structural ctx type for superRefine (portable across builds) */
export type RefinementCtx = { addIssue: (issue: ZodIssue) => void };

/** Portable errorMap type (structural, no dependency on z.setErrorMap) */
type ZodErrorMap = (issue: { code?: unknown }, ctx?: unknown) => { message?: string };

/** String enum helper with nice errors; works across vendored/variant Zod builds */
export const stringEnum = <T extends readonly string[]>(
  values: T,
  label?: string
) => {
  const errorMap: ZodErrorMap = (issue) => {
    const code = (issue as any).code;
    const enumCode =
      (z as any).ZodIssueCode?.invalid_enum_value ?? "invalid_enum_value";
    if (code === enumCode) {
      const list = values.join(", ");
      return { message: label ? `${label} must be one of: ${list}` : `Must be one of: ${list}` };
    }
    return { message: "Invalid value" };
  };

  return (z as any).enum(values as any, { errorMap }) as Z.ZodEnum<
    [string, ...string[]]
  >;
};

/** Default export for defensive compatibility (so `import z from "@/lib/z"` won't be undefined) */
export default z;
