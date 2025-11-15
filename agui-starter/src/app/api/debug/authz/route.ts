import { NextResponse } from "next/server";

import { getCurrentEntityAndPolicies } from "@/lib/policy/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "edge";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { entityId, policyKeys } = await getCurrentEntityAndPolicies();
  return NextResponse.json({ entityId, policyKeys });
}
