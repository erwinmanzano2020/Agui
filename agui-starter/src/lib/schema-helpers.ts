import { z } from "zod";

/**
 * Builds a string schema constrained to a runtime list of allowed values.
 * Uses a refinement plus transform so the inferred type narrows to the union
 * of the provided values even when `allowed` is a mutable array.
 */
export function stringEnum<T extends readonly string[]>(
  allowed: T,
  label = "value",
) {
  const values = [...allowed];
  return z
    .string()
    .refine((value): value is T[number] => values.includes(value as T[number]), {
      message: `${label} must be one of: ${values.join(", ")}`,
    })
    .transform((value) => value as T[number]);
}
