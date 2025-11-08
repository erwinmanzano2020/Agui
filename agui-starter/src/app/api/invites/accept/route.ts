import type { User } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { grantGuildRole, grantHouseRole } from "@/lib/identity/roles";
import {
  listAccountUserIds,
  parseOnboardEmployeeResult,
  type OnboardEmployeeResult,
} from "@/lib/employments";
import { getInviteByToken, markInviteAccepted, type InviteRecord } from "@/lib/invites";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceSupabase } from "@/lib/supabase-service";

function normalizeEmail(email: string | null | undefined): string | null {
  if (typeof email !== "string") {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

type AcceptInvitePayload = {
  token?: string;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const payload = ((await req.json().catch(() => null)) ?? {}) as AcceptInvitePayload;
  const token = typeof payload.token === "string" ? payload.token.trim() : "";

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
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

  let invite: InviteRecord | null;
  try {
    invite = await getInviteByToken(token);
  } catch (error) {
    console.error("Failed to load invite", error);
    return NextResponse.json({ error: "Failed to load invite" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status !== "PENDING" || (invite.consumed_at && invite.consumed_at.length > 0)) {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }
  }

  if (invite.kind === "employee" || invite.kind === "owner") {
    return acceptEmploymentInvite(user, invite);
  }

  return acceptLegacyInvite(user, invite);
}

async function acceptEmploymentInvite(user: User, invite: InviteRecord) {
  if (!invite.business_id) {
    return NextResponse.json({ error: "Invite missing business context" }, { status: 400 });
  }

  const inviteEmail = normalizeEmail(invite.email);
  const userEmail = normalizeEmail(user.email ?? null);
  if (inviteEmail && inviteEmail !== userEmail) {
    return NextResponse.json({ error: "Invite email does not match your account" }, { status: 403 });
  }

  let entityId: string;
  try {
    entityId = await ensureEntityForUser(user);
  } catch (error) {
    console.error("Failed to ensure entity for invite acceptance", error);
    return NextResponse.json({ error: "Failed to prepare account" }, { status: 500 });
  }

  const service = getServiceSupabase();
  const fallbackRoleSlug = invite.role_id ? null : invite.kind === "owner" ? "house_owner" : "house_staff";
  let onboarded: OnboardEmployeeResult = { employment: null, houseRole: null };
  try {
    const { data, error } = await service.rpc("onboard_employee", {
      p_house_id: invite.business_id,
      p_entity_id: entityId,
      p_role_id: invite.role_id ?? null,
      p_role_slug: fallbackRoleSlug,
    });

    if (error) {
      throw error;
    }

    onboarded = parseOnboardEmployeeResult(data);

    if (!onboarded.employment) {
      throw new Error("onboard_employee did not return employment");
    }
  } catch (error) {
    console.error("Failed to activate employment", error);
    return NextResponse.json({ error: "Failed to activate employment" }, { status: 500 });
  }

  try {
    await markInviteAccepted(invite.id);
  } catch (error) {
    console.error("Failed to mark invite accepted", error);
    return NextResponse.json({ error: "Failed to finalize invite" }, { status: 500 });
  }

  try {
    const relatedUserIds = await listAccountUserIds(entityId).catch((error) => {
      console.error("Failed to load account links for employment revalidation", error);
      return [] as string[];
    });
    const targets = new Set<string>([user.id, ...relatedUserIds]);
    for (const userId of targets) {
      revalidateTag(`tiles:user:${userId}`);
    }
  } catch (error) {
    console.error("Failed to revalidate tiles after invite acceptance", error);
  }

  return NextResponse.json({
    ok: true,
    kind: invite.kind,
    businessId: invite.business_id,
    roleId: invite.role_id,
    employmentId: onboarded.employment?.id ?? null,
    houseRole: onboarded.houseRole?.role ?? null,
  });
}

async function acceptLegacyInvite(user: User, invite: InviteRecord) {
  const inviteEmail = normalizeEmail(invite.email);
  const userEmail = normalizeEmail(user.email ?? null);

  if (!inviteEmail || !userEmail || inviteEmail !== userEmail) {
    return NextResponse.json({ error: "Invite email does not match your account" }, { status: 403 });
  }

  let entityId: string;
  try {
    entityId = await ensureEntityForUser(user);
  } catch (error) {
    console.error("Failed to ensure entity for invite acceptance", error);
    return NextResponse.json({ error: "Failed to prepare account" }, { status: 500 });
  }

  const inviteRoles = Array.from(
    new Set(
      (invite.role ?? "")
        .split(",")
        .map((role) => role.trim())
        .filter((role) => role.length > 0),
    ),
  );

  if (inviteRoles.length === 0) {
    return NextResponse.json({ error: "Invite missing role assignments" }, { status: 400 });
  }

  try {
    if (invite.scope === "HOUSE") {
      if (!invite.house_id) {
        return NextResponse.json({ error: "Invite missing house context" }, { status: 400 });
      }
      for (const role of inviteRoles) {
        await grantHouseRole(entityId, invite.house_id, role, { grantedBy: invite.invited_by ?? undefined });
      }
    } else if (invite.scope === "GUILD") {
      if (!invite.guild_id) {
        return NextResponse.json({ error: "Invite missing guild context" }, { status: 400 });
      }
      for (const role of inviteRoles) {
        await grantGuildRole(entityId, invite.guild_id, role, { grantedBy: invite.invited_by ?? undefined });
      }
    } else {
      return NextResponse.json({ error: "Unsupported invite scope" }, { status: 400 });
    }
  } catch (error) {
    console.error("Failed to grant invite role", error);
    return NextResponse.json({ error: "Failed to grant role" }, { status: 500 });
  }

  try {
    await markInviteAccepted(invite.id);
  } catch (error) {
    console.error("Failed to mark invite accepted", error);
    return NextResponse.json({ error: "Failed to finalize invite" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    scope: invite.scope,
    guildId: invite.guild_id,
    houseId: invite.house_id,
  });
}
