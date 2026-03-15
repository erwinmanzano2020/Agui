import { NextResponse } from "next/server";

import { PosShiftError, submitBlindDrop } from "@/lib/pos/shifts.server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      shiftId?: string;
      denominations?: unknown;
      notes?: unknown;
    };

    if (!payload.shiftId) {
      return NextResponse.json({ error: "shiftId is required" }, { status: 400 });
    }

    const result = await submitBlindDrop({
      shiftId: payload.shiftId,
      denominations: payload.denominations,
      notes: payload.notes,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PosShiftError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("pos shift submit failed", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
