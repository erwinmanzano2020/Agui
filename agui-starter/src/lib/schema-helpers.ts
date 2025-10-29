import { z } from "@/lib/z";
import type { ZodEnum } from "zod";

/** Builds a string enum validator from a readonly tuple of values. */
export function stringEnum<const Values extends readonly [string, ...string[]]>(
  values: Values,
  label = "value",
) {
  if (typeof (z as { enum?: unknown }).enum === "function") {
    return (z.enum as (vals: Values) => ZodEnum<Values>)(values);
  }
  const allowed = new Set(values);
  const fallback = z.string().refine((candidate: unknown): candidate is Values[number] => {
    if (typeof candidate !== "string") {
      return false;
    }
    return allowed.has(candidate as Values[number]);
  }, {
    message: `${label} must be one of: ${values.join(", ")}`,
  });
  return fallback as unknown as ZodEnum<Values>;
}
