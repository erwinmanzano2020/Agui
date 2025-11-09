import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPoliciesForCurrentUser } from "@/lib/policy/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const policies = await listPoliciesForCurrentUser(supabase);
    const payload = policies.map((policy) => ({
      id: policy.id,
      key: policy.key,
      action: policy.action,
      resource: policy.resource,
    }));
    return NextResponse.json({ ok: true, policies: payload });
  } catch (error) {
    console.warn("/api/_health/policy failed", error);
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}
