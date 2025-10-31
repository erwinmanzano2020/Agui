// src/lib/z.ts
import * as Z from "zod";

type ZodModule = typeof import("zod");
type ExtendedZodModule = ZodModule & {
  default?: unknown;
  z?: unknown;
};

const namespace = Z as ExtendedZodModule;

const resolveZ = (): ZodModule => {
  const candidates = [
    namespace,
    namespace.z,
    namespace.default,
  ] as const;

  for (const candidate of candidates) {
    if (candidate && typeof (candidate as any).enum === "function") {
      return candidate as ZodModule;
    }
  }

  return namespace as ZodModule;
};

/** Single import surface */
export const z: ZodModule = resolveZ();

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
    // Handle both "ZodIssueCode.invalid_enum_value" and string fallback
    const enumCode =
      (z as any).ZodIssueCode?.invalid_enum_value ?? "invalid_enum_value";

    if (code === enumCode) {
      const list = values.join(", ");
      return { message: label ? `${label} must be one of: ${list}` : `Must be one of: ${list}` };
    }
    return { message: "Invalid value" };
  };

  // Cast keeps compatibility even if underlying Zod’s enum types differ slightly
  return (z as any).enum(values as any, { errorMap }) as Z.ZodEnum<
    [string, ...string[]]
  >;
};
