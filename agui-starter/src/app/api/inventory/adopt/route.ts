import { NextResponse } from "next/server";

import { loadZod } from "@/lib/safe-schema";
import { INVENTORY_SOURCES, adoptInventory } from "@/lib/inventory/runtime";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const { z } = await loadZod();
  const schema = z
    .object({
      source: z.enum(INVENTORY_SOURCES, {
        errorMap: () => ({ message: `source must be one of: ${INVENTORY_SOURCES.join(", ")}` }),
      }),
      dryRun: z.boolean().optional(),
    })
    .strict();

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await adoptInventory(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use POST /api/inventory/adopt with JSON body { source, dryRun? }",
    },
    { status: 405 },
  );
}
