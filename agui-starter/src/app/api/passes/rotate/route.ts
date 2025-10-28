import { NextResponse } from "next/server";

type RotateRequest = {
  passId?: string;
  memberId?: string;
  reason?: string;
  dryRun?: boolean;
};

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 }
    );
  }

  let body: RotateRequest;
  try {
    body = (await req.json()) as RotateRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const passId = typeof body.passId === "string" ? body.passId.trim() : "";
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 200)
      : undefined;
  const dryRun = Boolean(body?.dryRun);

  if (!passId && !memberId) {
    return NextResponse.json(
      { ok: false, error: "Provide passId or memberId" },
      { status: 400 }
    );
  }

  const now = new Date();
  const rotation = {
    id: passId || `pass_for_${memberId}`,
    rotatedAt: now.toISOString(),
    rotationId: `rot_${Math.random().toString(36).slice(2, 10)}`,
    reason,
    dryRun,
  };

  return NextResponse.json({ ok: true, rotation });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/passes/rotate with JSON body" },
    { status: 405 }
  );
}
