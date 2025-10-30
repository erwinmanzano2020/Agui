// A single, shape-proof Zod export for SSR, RSC, and API routes.
// Handles default, namespace, and named `z` exports safely.
import * as ZNS from "zod";
import type { ZodIssue } from "zod";

const candidate =
  (ZNS as any)?.z ??
  (ZNS as any)?.default?.z ??
  (ZNS as any)?.default ??
  (ZNS as any);

type ZLike = typeof ZNS;

function assertZod(z: unknown): asserts z is ZLike {
  const runtime = z as Record<string, unknown> | null | undefined;
  const ok =
    !!runtime &&
    typeof runtime.object === "function" &&
    typeof runtime.string === "function" &&
    typeof runtime.enum === "function" &&
    typeof runtime.array === "function";

  if (!ok) {
    throw new Error(
      `[ZOD_IMPORT_BROKEN] Resolved 'z' is invalid. Module keys: ${Object.keys(ZNS || {})
        .slice(0, 16)
        .join(",") || "(none)"}`,
    );
  }
}

assertZod(candidate);

export const z: ZLike = candidate;
export type { ZodType, ZodIssue } from "zod";
export type RefinementCtx = { addIssue(issue: ZodIssue): void };
