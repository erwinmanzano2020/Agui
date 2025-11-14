import { NextResponse } from "next/server";

import { openShift, PosShiftError } from "@/lib/pos/shifts.server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      branchId?: string;
      cashierEntityId?: string;
      openingFloat?: unknown;
    };

    if (!payload.branchId) {
      return NextResponse.json({ error: "branchId is required" }, { status: 400 });
    }

    const result = await openShift({
      branchId: payload.branchId,
      cashierEntityId: payload.cashierEntityId,
      openingFloat: payload.openingFloat,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PosShiftError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("pos shift open failed", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
