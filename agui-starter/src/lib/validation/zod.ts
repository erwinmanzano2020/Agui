import * as Z from "zod";

/** Namespace export (never default). */
export { Z };

/**
 * Validate a string against allowed values using a tuple while surfacing
 * friendly error messaging. Requires at least one option to avoid runtime
 * fallbacks.
 */
export function stringEnum<const Values extends readonly [string, ...string[]]>(
  values: Values,
  label = "value",
) {
  return Z.enum(values, {
    errorMap: () => ({
      message: `${label} must be one of: ${values.join(", ")}`,
    }),
  });
}
