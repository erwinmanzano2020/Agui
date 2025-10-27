// agui-starter/src/app/api/payroll/summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { summarizeRange } from "@/lib/payroll/index";
import type { PrimaryBasis, RangeSummary } from "@/lib/payroll/index";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  await requireFeatureAccess(AppFeature.PAYROLL, { dest: new URL(req.url).pathname });
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
    const sb = getSupabase();
    if (!sb) {
      return NextResponse.json(
        { error: "Supabase not configured" },
        { status: 500 },
      );
    }

    const summary = await summarizeRange(sb, {
      from,
      to,
      employeeId,
      preferBasis,
      settings: {
        ...(hoursPerDay ? { hours_per_day: hoursPerDay } : {}),
      },
    });

    return NextResponse.json<RangeSummary>(summary, { status: 200 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to summarize range";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
