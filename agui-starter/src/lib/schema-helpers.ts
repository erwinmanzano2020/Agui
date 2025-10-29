import { z as Z } from "zod";
import type { ZodString } from "zod";

/**
 * Validate that a string matches one of the allowed values without relying on
 * Zod's enum helper. This keeps runtime arrays flexible while preserving
 * literal union inference for callers.
 */
export function stringEnum<const Values extends readonly [string, ...string[]]>(
  values: Values,
  label = "value",
): ZodString<Values[number]> {
  const allowed = [...values] as readonly [...Values];
  const schema = Z.string().refine(
    (candidate: string) => (allowed as readonly string[]).includes(candidate),
    {
      message: `${label} must be one of: ${allowed.join(", ")}`,
    },
  );

  return schema as ZodString<Values[number]>;
}
