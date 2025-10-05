// agui-starter/src/app/api/payroll/summary/route.ts
import { NextResponse } from "next/server";
import { summarizeRange } from "@/lib/payroll/index";
import type { PrimaryBasis } from "@/lib/payroll/index";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const employeeIdParam = url.searchParams.get("employeeId");
  const preferBasisParam = url.searchParams.get("preferBasis");
  const hoursPerDayParam = url.searchParams.get("hoursPerDay"); // optional

  if (!from || !to) {
    return NextResponse.json(
      { error: "Missing required query params: 'from' and 'to' (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const employeeId = employeeIdParam ?? undefined;
  const preferBasis = (preferBasisParam as PrimaryBasis | null) ?? undefined;

  // optional settings
  const hoursPerDay = hoursPerDayParam ? Number(hoursPerDayParam) : undefined;

  try {
    const summary = await summarizeRange(supabase, {
      from,
      to,
      employeeId,
      preferBasis,
      settings: {
        ...(hoursPerDay ? { hours_per_day: hoursPerDay } : {}),
      },
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to summarize range" },
      { status: 500 },
    );
  }
}
