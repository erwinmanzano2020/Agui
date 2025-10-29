import { NextResponse } from "next/server";

import { z } from "@/lib/z";

import { INVENTORY_SOURCES, adoptInventory } from "@/lib/inventory/runtime";
import { stringEnum } from "@/lib/schema-helpers";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const schema = z
    .object({
      source: stringEnum(INVENTORY_SOURCES),
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
