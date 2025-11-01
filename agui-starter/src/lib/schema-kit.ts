import { z, stringEnum } from "@/lib/z";

/** Shared enums (single source of truth) */
export const Channel = stringEnum(
  ["cashier", "kiosk", "self-service"] as const,
  "Channel"
);
export const LoyaltyPlan = stringEnum(
  ["starter", "plus", "pro"] as const,
  "Plan"
);

/** Short-hands */
export const id = () => z.string().min(1, "ID required");
export const phone = () =>
  z.string().regex(/^[0-9]{10,13}$/, "Phone must be 10–13 digits");

/** Safe Zod parse that returns { ok, data|issues } */
export function safeParse<T extends z.ZodTypeAny>(schema: T, input: unknown) {
  const r = schema.safeParse(input);
  return r.success
    ? { ok: true as const, data: r.data }
    : { ok: false as const, issues: r.error.issues };
}
