import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeDailyPayslip } from "@/lib/payroll/computeDailyPayslip";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeId, from, to, presentDays } = body ?? {};

    if (!employeeId || !from || !to || !Array.isArray(presentDays)) {
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

    const result = await computeDailyPayslip(supabase, {
      employeeId,
      from,
      to,
      presentDays,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Server error" },
      { status: 500 },
    );
  }
}
