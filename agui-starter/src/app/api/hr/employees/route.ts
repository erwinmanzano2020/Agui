import { NextRequest, NextResponse } from "next/server";

import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { listEmployeesForHouse } from "@/lib/hr/employees-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, HouseRoleRow } from "@/lib/db.types";

async function resolveHouseForEntity(
  service: SupabaseClient<Database>,
  entityId: string,
  explicitHouseId?: string | null,
): Promise<string | null> {
  const requestedHouseId = explicitHouseId?.trim();
  if (requestedHouseId) {
    const { data, error } = await service
      .from("house_roles")
      .select("house_id")
      .eq("entity_id", entityId)
      .eq("house_id", requestedHouseId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return (data as Pick<HouseRoleRow, "house_id"> | null)?.house_id ?? null;
  }

  const { data, error } = await service
    .from("house_roles")
    .select("house_id")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Pick<HouseRoleRow, "house_id">[];
  return rows[0]?.house_id ?? null;
}

export async function GET(req: NextRequest) {
  const guard = await requireAnyFeatureAccessApi([
    AppFeature.PAYROLL,
    AppFeature.TEAM,
    AppFeature.DTR_BULK,
  ]);
  if (guard) {
    return guard;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!userResult.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = getServiceSupabase();
  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(userResult.user, service);
  } catch (error) {
    console.error("Failed to resolve entity for employees lookup", error);
    return NextResponse.json({ error: "Failed to resolve account" }, { status: 500 });
  }

  if (!entityId) {
    return NextResponse.json({ error: "Account not linked" }, { status: 403 });
  }

  const url = new URL(req.url);
  const requestedHouseId = url.searchParams.get("houseId");

  let houseId: string | null = null;
  try {
    houseId = await resolveHouseForEntity(service, entityId, requestedHouseId);
  } catch (error) {
    console.error("Failed to resolve house for employees lookup", error);
    return NextResponse.json({ error: "Failed to resolve house" }, { status: 500 });
  }

  if (!houseId) {
    return NextResponse.json({ error: "No accessible house" }, { status: 403 });
  }

  try {
    const employees = await listEmployeesForHouse(service, houseId);
    return NextResponse.json({ employees }, { status: 200 });
  } catch (error) {
    console.error("Failed to load employees for house", error);
    return NextResponse.json({ error: "Failed to load employees" }, { status: 500 });
  }
}
