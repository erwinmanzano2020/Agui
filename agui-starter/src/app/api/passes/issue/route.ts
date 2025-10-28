import { NextResponse } from "next/server";

const ALLOWED_PASS_TYPES = new Set(["alliance", "member", "staff"]);
const ALLOWED_CHANNELS = new Set(["kiosk", "pos", "admin"]);

interface IssueRequest {
  memberId?: unknown;
  passType?: unknown;
  channel?: unknown;
  expiresInDays?: unknown;
  dryRun?: unknown;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  let payload: IssueRequest;
  try {
    payload = (await req.json()) as IssueRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const memberId = typeof payload.memberId === "string" ? payload.memberId.trim() : "";
  const passType = typeof payload.passType === "string" ? payload.passType.trim() : "";
  const channel = typeof payload.channel === "string" ? payload.channel.trim() : "";

  const expiresInDaysRaw = typeof payload.expiresInDays === "number" ? payload.expiresInDays : undefined;
  const expiresInDays = Number.isFinite(expiresInDaysRaw)
    ? Math.max(1, Math.floor(expiresInDaysRaw!))
    : 30;
  const dryRun = Boolean(payload?.dryRun);

  if (!memberId) {
    return NextResponse.json({ ok: false, error: "memberId is required" }, { status: 400 });
  }

  if (!passType || !ALLOWED_PASS_TYPES.has(passType)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid passType",
        details: { allowed: Array.from(ALLOWED_PASS_TYPES) },
      },
      { status: 400 },
    );
  }

  if (channel && !ALLOWED_CHANNELS.has(channel)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid channel",
        details: { allowed: Array.from(ALLOWED_CHANNELS) },
      },
      { status: 400 },
    );
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setDate(issuedAt.getDate() + expiresInDays);

  const pass = {
    id: `pass_${Math.random().toString(36).slice(2, 10)}`,
    memberId,
    passType,
    channel: channel || "admin",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    dryRun,
  };

  return NextResponse.json({ ok: true, pass });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/passes/issue with JSON body" },
    { status: 405 },
  );
}
