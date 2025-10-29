import { z } from "zod";

/** Builds a string enum validator from a readonly tuple of values. */
export function stringEnum<const Values extends readonly [string, ...string[]]>(
  values: Values,
) {
  return z.enum(values);
}
