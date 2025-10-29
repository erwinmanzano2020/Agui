import { z as _z } from "zod";

function assertZod(z: typeof _z) {
  const runtime = z as Record<string, unknown>;
  const ok =
    typeof runtime === "object" &&
    typeof runtime.object === "function" &&
    typeof runtime.string === "function" &&
    typeof runtime.enum === "function";

  if (!ok) {
    throw new Error(
      `[ZOD_IMPORT_BROKEN] z appears invalid in ${typeof import.meta !== "undefined" && import.meta?.url ? import.meta.url : "(no-meta)"}`
    );
  }

  return z;
}

export const z = assertZod(_z);
export type { ZodType, ZodIssue } from "zod";
