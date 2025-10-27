import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getInviteByToken, markInviteAccepted } from "@/lib/invites";
import { ensureEntityForUser } from "@/lib/identity/entity-server";
import { grantGuildRole, grantHouseRole } from "@/lib/identity/roles";

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

  let invite;
  try {
    invite = await getInviteByToken(token);
  } catch (error) {
    console.error("Failed to load invite", error);
    return NextResponse.json({ error: "Failed to load invite" }, { status: 500 });
  }

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.status !== "PENDING") {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  if (invite.expires_at) {
    const expiresAt = new Date(invite.expires_at);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }
  }

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

  try {
    if (invite.scope === "HOUSE") {
      if (!invite.house_id) {
        return NextResponse.json({ error: "Invite missing house context" }, { status: 400 });
      }
      await grantHouseRole(entityId, invite.house_id, invite.role, { grantedBy: invite.invited_by });
    } else if (invite.scope === "GUILD") {
      if (!invite.guild_id) {
        return NextResponse.json({ error: "Invite missing guild context" }, { status: 400 });
      }
      await grantGuildRole(entityId, invite.guild_id, invite.role, { grantedBy: invite.invited_by });
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
