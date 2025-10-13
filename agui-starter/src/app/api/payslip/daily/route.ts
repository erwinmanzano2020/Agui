import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeDailyPayslip } from "@/lib/payroll/computeDailyPayslip";

type PayslipDailyRequest = {
  employeeId: string | number;
  from: string;
  to: string;
  presentDays: string[];
};

function isPayslipDailyRequest(value: unknown): value is PayslipDailyRequest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    (typeof record.employeeId === "string" ||
      typeof record.employeeId === "number") &&
    typeof record.from === "string" &&
    typeof record.to === "string" &&
    Array.isArray(record.presentDays) &&
    record.presentDays.every((day) => typeof day === "string")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;

    if (!isPayslipDailyRequest(body)) {
      return NextResponse.json(
        { error: "Required: employeeId, from, to, presentDays[]" },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json(
        {
          error:
            "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(url, key);

    // quick preflight to surface RLS/permission errors clearly
    const { error: preError } = await supabase
      .from("dtr_with_rates")
      .select("work_date")
      .limit(1);

    if (preError) {
      return NextResponse.json(
        {
          error: "Cannot read dtr_with_rates",
          detail: preError.message ?? preError,
        },
        { status: 500 },
      );
    }

    const result = await computeDailyPayslip(supabase, body);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
