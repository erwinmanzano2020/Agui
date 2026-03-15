import { NextResponse } from "next/server";

import { getMyRoles } from "@/lib/authz/server";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { listAccountUserIds } from "@/lib/employments";
import { emitEvents } from "@/lib/events/server";

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const applicationId = normalizeString((body as { applicationId?: unknown }).applicationId);
  const reason = normalizeString((body as { reason?: unknown }).reason);

  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
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

  const service = getServiceSupabase();
  let actorEntityId: string;
  try {
    const resolved = await resolveEntityIdForUser(user, service);
    if (!resolved) {
      return NextResponse.json({ error: "Account not linked to entity" }, { status: 400 });
    }
    actorEntityId = resolved;
  } catch (error) {
    console.error("Failed to resolve actor entity", error);
    return NextResponse.json({ error: "Failed to resolve entity" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");

  const { data: application, error: applicationError } = await service
    .from("applications")
    .select("id, business_id, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    console.error("Failed to load application", applicationError);
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
  }

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (application.status !== "pending") {
    return NextResponse.json({ error: "Application already processed" }, { status: 400 });
  }

  let authorized = isGM;
  if (!authorized) {
    const { data, error } = await service
      .from("house_roles")
      .select("role")
      .eq("entity_id", actorEntityId)
      .eq("house_id", application.business_id);

    if (error) {
      console.error("Failed to verify actor permissions", error);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    authorized = (data ?? []).some((entry) =>
      entry && typeof entry.role === "string" && ["house_owner", "house_manager"].includes(entry.role),
    );
  }

  if (!authorized) {
    return forbidden("Insufficient permissions to reject applications");
  }

  const { error: updateError } = await service
    .from("applications")
    .update({
      status: "rejected",
      notes: reason || null,
      decided_by: actorEntityId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "pending");

  if (updateError) {
    console.error("Failed to reject application", updateError);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }

  try {
    const userIds = await listAccountUserIds(actorEntityId).catch((error) => {
      console.error("Failed to load approver accounts for revalidation", error);
      return [] as string[];
    });
    const targets = new Set<string>(userIds);
    if (user.id) {
      targets.add(user.id);
    }
    const topics = Array.from(targets).map((id) => `tiles:user:${id}`);
    if (topics.length > 0) {
      await emitEvents(topics, "invalidate", {
        reason: "application rejected",
        applicationId,
        businessId: application.business_id,
      });
    }
  } catch (error) {
    console.error("Failed to revalidate tiles after rejection", error);
  }

  return NextResponse.json({ ok: true });
}
