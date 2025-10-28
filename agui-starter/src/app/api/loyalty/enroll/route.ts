import { NextResponse } from "next/server";

const ALLOWED_CHANNELS = new Set(["kiosk", "cashier", "self-service"]);
const ALLOWED_PLANS = new Set(["basic", "premium"]);

type EnrollIn = {
  memberId?: string;
  phone?: string;
  channel?: string;
  plan?: string;
  dryRun?: boolean;
};

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 }
    );
  }

  let body: EnrollIn;
  try {
    body = (await req.json()) as EnrollIn;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const channel = typeof body.channel === "string" ? body.channel : "";
  const plan = typeof body.plan === "string" ? body.plan : "";
  const dryRun = Boolean(body?.dryRun);

  if (!memberId && !phone) {
    return NextResponse.json(
      { ok: false, error: "Provide at least one identifier: memberId or phone" },
      { status: 400 }
    );
  }

  if (channel && !ALLOWED_CHANNELS.has(channel)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid channel",
        details: { allowed: Array.from(ALLOWED_CHANNELS) },
      },
      { status: 400 }
    );
  }

  if (plan && !ALLOWED_PLANS.has(plan)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid plan",
        details: { allowed: Array.from(ALLOWED_PLANS) },
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    enrolled: {
      by: channel || "unspecified",
      plan: plan || "basic",
      identifier: memberId || phone,
      dryRun,
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Use POST /api/loyalty/enroll with JSON body",
    },
    { status: 405 }
  );
}
