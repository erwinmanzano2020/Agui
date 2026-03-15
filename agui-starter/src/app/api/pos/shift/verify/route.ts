import { NextResponse } from "next/server";

import { PosShiftError, verifyDrop } from "@/lib/pos/shifts.server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      shiftId?: string;
      denominations?: unknown;
      resolution?: "PAID_NOW" | "PAYROLL_DEDUCT" | "OVERAGE_OFFSET" | "ESCALATED";
      resolutionMeta?: Record<string, unknown> | null;
      notes?: unknown;
    };

    if (!payload.shiftId) {
      return NextResponse.json({ error: "shiftId is required" }, { status: 400 });
    }
    if (!payload.resolution) {
      return NextResponse.json({ error: "resolution is required" }, { status: 400 });
    }

    const result = await verifyDrop({
      shiftId: payload.shiftId,
      denominations: payload.denominations,
      resolution: payload.resolution,
      resolutionMeta: payload.resolutionMeta ?? null,
      notes: payload.notes,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PosShiftError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("pos shift verify failed", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
