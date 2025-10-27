import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { getMyRoles } from "@/lib/authz/server";
import { ensureEntityForUser, resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { AppFeature, canAccess } from "@/lib/auth/permissions";

const CLOCK_ROLES = new Set(["house_staff", "cashier", "house_manager"]);

type ClockRequestBody = {
  houseId?: string;
  kind?: "IN" | "OUT";
};

async function authorizeForHouse(
  entityId: string,
  houseId: string,
  roles: Awaited<ReturnType<typeof getMyRoles>>,
): Promise<boolean> {
  if (roles.PLATFORM.includes("game_master")) {
    return true;
  }

  const service = getServiceSupabase();
  const { data, error } = await service
    .from("house_roles")
    .select("role")
    .eq("entity_id", entityId)
    .eq("house_id", houseId);

  if (error) {
    console.error("Failed to verify house membership", error);
    throw new Error("Failed to verify membership");
  }

  const hasRole = (data ?? []).some((entry) => CLOCK_ROLES.has(entry.role ?? ""));
  if (hasRole) {
    return true;
  }

  if (canAccess(AppFeature.POS, roles)) {
    return (data ?? []).some((entry) => entry.role === "cashier" || entry.role === "house_manager");
  }

  return false;
}

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const houseId = url.searchParams.get("houseId");

  if (!houseId) {
    return NextResponse.json({ error: "houseId is required" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const roles = await getMyRoles(supabase);
  const entityId = await resolveEntityIdForUser(user).catch((error) => {
    console.error("Failed to resolve entity for clock lookup", error);
    return null;
  });

  if (!entityId) {
    return NextResponse.json({ error: "Entity not found" }, { status: 400 });
  }

  try {
    const allowed = await authorizeForHouse(entityId, houseId, roles);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authorization failed" }, { status: 500 });
  }

  const service = getServiceSupabase();
  const { data, error: queryError } = await service
    .from("clock_events")
    .select("id, kind, created_at")
    .eq("entity_id", entityId)
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    console.error("Failed to load clock events", queryError);
    return NextResponse.json({ error: "Failed to load clock events" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    lastEvent: data
      ? {
          id: data.id,
          kind: data.kind,
          createdAt: data.created_at,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = ((await req.json().catch(() => null)) ?? {}) as ClockRequestBody;
  const houseId = typeof body.houseId === "string" ? body.houseId.trim() : "";
  const kind = body.kind === "IN" || body.kind === "OUT" ? body.kind : null;

  if (!houseId) {
    return NextResponse.json({ error: "houseId is required" }, { status: 400 });
  }

  if (!kind) {
    return NextResponse.json({ error: "kind must be IN or OUT" }, { status: 400 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let entityId: string;
  try {
    entityId = await ensureEntityForUser(user);
  } catch (error) {
    console.error("Failed to ensure entity for clock", error);
    return NextResponse.json({ error: "Failed to prepare account" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  try {
    const allowed = await authorizeForHouse(entityId, houseId, roles);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Authorization failed" }, { status: 500 });
  }

  const service = getServiceSupabase();
  const { data, error: insertError } = await service
    .from("clock_events")
    .insert({
      entity_id: entityId,
      house_id: houseId,
      kind,
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error("Failed to write clock event", insertError);
    return NextResponse.json({ error: "Failed to record clock event" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    event: {
      id: data.id,
      houseId,
      kind,
      createdAt: data.created_at,
    },
  });
}
