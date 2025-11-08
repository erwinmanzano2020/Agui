import { headers, type UnsafeUnwrappedHeaders } from "next/headers";
import { NextResponse } from "next/server";

import { getMyRoles } from "@/lib/authz/server";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { createEmploymentInvite, createInvite } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";
import type { AnySupabaseClient } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTilesForUser } from "@/lib/tiles/server";

const HOUSE_INVITER_ROLES = new Set(["house_manager", "house_owner"]);
const HOUSE_INVITEE_ROLES = new Set(["house_manager", "cashier", "house_staff"]);
const GUILD_INVITER_ROLES = new Set(["guild_master", "guild_elder"]);
const GUILD_INVITEE_ROLES = new Set(["guild_master", "guild_elder"]);

type CreateInvitePayload = {
  email?: string;
  scope?: "HOUSE" | "GUILD";
  guildId?: string | null;
  houseId?: string | null;
  role?: string;
  roles?: unknown;
};

type EmploymentInvitePayload = {
  kind?: string | null;
  businessId?: string | null;
  roleId?: string | null;
  phone?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (typeof phone !== "string") {
    return null;
  }
  const trimmed = phone.trim();
  if (!trimmed) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) {
    return null;
  }
  return `+${digits}`;
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isEmploymentInvite(body: CreateInvitePayload & EmploymentInvitePayload): boolean {
  return (
    typeof body.kind === "string" ||
    typeof body.businessId === "string" ||
    typeof body.roleId === "string" ||
    typeof body.phone === "string"
  );
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = ((await req.json().catch(() => null)) ?? {}) as CreateInvitePayload & EmploymentInvitePayload;

  if (isEmploymentInvite(body)) {
    return handleEmploymentInviteRequest(supabase, body);
  }

  return handleLegacyInviteRequest(supabase, body);
}

async function handleEmploymentInviteRequest(
  supabase: SupabaseClient,
  payload: CreateInvitePayload & EmploymentInvitePayload,
) {
  const kind = payload.kind === "owner" ? "owner" : payload.kind === "employee" ? "employee" : null;
  if (!kind) {
    return badRequest("Invite kind must be 'employee' or 'owner'");
  }

  const businessId = typeof payload.businessId === "string" ? payload.businessId.trim() : "";
  if (!businessId) {
    return badRequest("Business ID is required");
  }

  const email = typeof payload.email === "string" ? normalizeEmail(payload.email) : null;
  const phone = normalizePhone(payload.phone ?? null);

  if (!email && !phone) {
    return badRequest("Email or phone is required");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return forbidden("Not authenticated");
  }

  const service = getServiceSupabase();
  let inviterEntityId: string;

  try {
    const entityId = await resolveEntityIdForUser(user, service);
    if (!entityId) {
      return NextResponse.json({ error: "Inviter entity not found" }, { status: 400 });
    }
    inviterEntityId = entityId;
  } catch (error) {
    console.error("Failed to resolve inviter entity", error);
    return NextResponse.json({ error: "Failed to resolve inviter entity" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  let authorized = isGM;

  if (!authorized) {
    const { data, error } = await service
      .from("house_roles")
      .select("role")
      .eq("entity_id", inviterEntityId)
      .eq("house_id", businessId);

    if (error) {
      console.error("Failed to verify house roles", error);
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }

    authorized = (data ?? []).some((entry) => HOUSE_INVITER_ROLES.has(entry.role ?? ""));
  }

  if (!authorized) {
    return forbidden("Insufficient permissions to invite members");
  }

  const { data: business, error: businessError } = await service
    .from("houses")
    .select("id")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    console.error("Failed to verify business", businessError);
    return NextResponse.json({ error: "Failed to verify business" }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  let roleId: string | null = null;
  if (typeof payload.roleId === "string" && payload.roleId.trim()) {
    const candidate = payload.roleId.trim();
    const { data: roleRow, error: roleError } = await service
      .from("roles")
      .select("id, scope, scope_ref")
      .eq("id", candidate)
      .maybeSingle();

    if (roleError) {
      console.error("Failed to verify role assignment", roleError);
      return NextResponse.json({ error: "Failed to verify role" }, { status: 500 });
    }

    if (!roleRow) {
      return badRequest("Role not found");
    }

    const scope = (roleRow as { scope?: string | null }).scope ?? null;
    const scopeRef = (roleRow as { scope_ref?: string | null }).scope_ref ?? null;
    if (scope !== "HOUSE" || (scopeRef && scopeRef !== businessId)) {
      return badRequest("Role not assignable to this business");
    }

    roleId = (roleRow as { id: string }).id;
  }

  let invite;
  try {
    invite = await createEmploymentInvite({
      kind,
      businessId,
      roleId,
      email,
      phone,
      createdBy: inviterEntityId,
    });
  } catch (error) {
    console.error("Failed to create employment invite", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  revalidateTilesForUser(user.id);

  const headerList = headers() as unknown as UnsafeUnwrappedHeaders;
  const origin = headerList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
  if (!origin) {
    console.error("Missing origin for invite redirect");
    return NextResponse.json({ error: "Site URL not configured" }, { status: 500 });
  }

  const redirectUrl = new URL("/auth/callback", origin);
  redirectUrl.searchParams.set("next", "/invite/accept");
  redirectUrl.searchParams.set("token", invite.token);
  const redirectTo = redirectUrl.toString();

  if (email) {
    try {
      const magicLink = await deliverInviteEmail(service, email, redirectTo);
      return NextResponse.json({ ok: true, token: invite.token, magicLink });
    } catch (error) {
      console.error("Failed to send invite email", error);
      return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, token: invite.token });
}

async function handleLegacyInviteRequest(supabase: SupabaseClient, body: CreateInvitePayload) {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const scope = body.scope === "HOUSE" || body.scope === "GUILD" ? body.scope : null;
  const guildId = typeof body.guildId === "string" && body.guildId ? body.guildId : null;
  const houseId = typeof body.houseId === "string" && body.houseId ? body.houseId : null;
  const rolesInput: string[] = [];
  if (Array.isArray(body.roles)) {
    for (const role of body.roles) {
      if (typeof role === "string" && role.trim()) {
        rolesInput.push(role.trim());
      }
    }
  }

  if (rolesInput.length === 0 && typeof body.role === "string" && body.role.trim()) {
    rolesInput.push(body.role.trim());
  }

  const uniqueRoles = Array.from(new Set(rolesInput));

  if (!email) {
    return badRequest("Email is required");
  }

  if (!scope) {
    return badRequest("Scope is required");
  }

  if (scope === "HOUSE" && !houseId) {
    return badRequest("House ID is required for house invites");
  }

  if (scope === "GUILD" && !guildId) {
    return badRequest("Guild ID is required for guild invites");
  }

  if (uniqueRoles.length === 0) {
    return badRequest("At least one role is required");
  }

  if (scope === "HOUSE" && !uniqueRoles.every((role) => HOUSE_INVITEE_ROLES.has(role))) {
    return badRequest("Invalid house role");
  }

  if (scope === "GUILD" && !uniqueRoles.every((role) => GUILD_INVITEE_ROLES.has(role))) {
    return badRequest("Invalid guild role");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return forbidden("Not authenticated");
  }

  const service = getServiceSupabase();
  let inviterEntityId: string;

  try {
    const entityId = await resolveEntityIdForUser(user, service);
    if (!entityId) {
      return NextResponse.json({ error: "Inviter entity not found" }, { status: 400 });
    }
    inviterEntityId = entityId;
  } catch (error) {
    console.error("Failed to resolve inviter entity", error);
    return NextResponse.json({ error: "Failed to resolve inviter entity" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  let authorized = isGM;

  if (!authorized) {
    if (scope === "HOUSE" && houseId) {
      const { data, error } = await service
        .from("house_roles")
        .select("role")
        .eq("entity_id", inviterEntityId)
        .eq("house_id", houseId);

      if (error) {
        console.error("Failed to verify house roles", error);
        return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
      }

      authorized = (data ?? []).some((entry) => HOUSE_INVITER_ROLES.has(entry.role ?? ""));
    } else if (scope === "GUILD" && guildId) {
      const { data, error } = await service
        .from("guild_roles")
        .select("role")
        .eq("entity_id", inviterEntityId)
        .eq("guild_id", guildId);

      if (error) {
        console.error("Failed to verify guild roles", error);
        return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
      }

      authorized = (data ?? []).some((entry) => GUILD_INVITER_ROLES.has(entry.role ?? ""));
    }
  }

  if (!authorized) {
    return forbidden("Insufficient permissions to invite members");
  }

  let invite;
  try {
    invite = await createInvite({
      email,
      scope,
      guildId,
      houseId,
      roles: uniqueRoles,
      invitedBy: inviterEntityId,
    });
  } catch (error) {
    console.error("Failed to create invite", error);
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }

  revalidateTilesForUser(user.id);

  const headerList = headers() as unknown as UnsafeUnwrappedHeaders;
  const origin = headerList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? null;
  if (!origin) {
    console.error("Missing origin for invite redirect");
    return NextResponse.json({ error: "Site URL not configured" }, { status: 500 });
  }

  const redirectUrl = new URL("/accept-invite", origin);
  redirectUrl.searchParams.set("token", invite.token);
  const redirectTo = redirectUrl.toString();

  try {
    const magicLink = await deliverInviteEmail(service, email, redirectTo);
    return NextResponse.json({ ok: true, magicLink });
  } catch (error) {
    console.error("Failed to send invite email", error);
    return NextResponse.json({ error: "Failed to send invite email" }, { status: 500 });
  }
}

async function deliverInviteEmail(
  service: AnySupabaseClient,
  email: string,
  redirectTo: string,
): Promise<string | null> {
  const { error: inviteErr } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });

  if (!inviteErr) {
    return null;
  }

  const alreadyExists = isAlreadyRegisteredError(inviteErr);

  if (!alreadyExists) {
    throw inviteErr;
  }

  const { data: linkData, error: linkErr } = await service.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkErr) {
    throw linkErr;
  }

  return extractActionLink(linkData);
}

function isAlreadyRegisteredError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  if (typeof status === "number" && status === 422) {
    return true;
  }

  const message = "message" in error ? (error as { message?: unknown }).message : undefined;
  return typeof message === "string" && /exists|registered/i.test(message);
}

function extractActionLink(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const properties = "properties" in data ? (data as { properties?: unknown }).properties : undefined;
  if (!properties || typeof properties !== "object") {
    return null;
  }

  const actionLink = "action_link" in properties ? (properties as { action_link?: unknown }).action_link : undefined;
  return typeof actionLink === "string" ? actionLink : null;
}
