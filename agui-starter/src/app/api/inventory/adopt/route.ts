import { NextResponse } from "next/server";

const ALLOWED_SOURCES = new Set(["demo-seed", "csv", "manual"]);

type AdoptRequest = {
  source?: unknown;
  dryRun?: unknown;
};

function parseBody(body: AdoptRequest) {
  const source = typeof body.source === "string" ? body.source : "";
  const dryRun = typeof body.dryRun === "boolean" ? body.dryRun : Boolean(body.dryRun);
  return { source, dryRun };
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { source, dryRun } = parseBody((payload ?? {}) as AdoptRequest);

  if (!ALLOWED_SOURCES.has(source)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid source",
        details: { allowed: Array.from(ALLOWED_SOURCES) },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, adopted: { source, dryRun } });
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
