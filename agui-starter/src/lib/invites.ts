import "server-only";

import { randomBytes } from "crypto";

import { getServiceSupabase } from "@/lib/supabase-service";

export type InviteScope = "GUILD" | "HOUSE";
export type InviteStatus = "PENDING" | "ACCEPTED" | "CANCELLED" | "EXPIRED";

export type InviteRecord = {
  id: string;
  email: string;
  scope: InviteScope;
  guild_id: string | null;
  house_id: string | null;
  role: string;
  token: string;
  status: InviteStatus;
  invited_by: string;
  expires_at: string;
  created_at: string;
};

export type CreateInviteInput = {
  email: string;
  scope: InviteScope;
  guildId?: string | null;
  houseId?: string | null;
  roles: string[];
  invitedBy: string;
  expiresAt?: Date;
};

function normalizeEmail(email: string): string {
  if (typeof email !== "string") {
    throw new Error("Email is required");
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("Email is required");
  }
  return trimmed;
}

function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export async function createInvite(input: CreateInviteInput): Promise<InviteRecord> {
  const svc = getServiceSupabase();
  const token = generateToken();
  const roles = Array.from(
    new Set(
      (input.roles ?? []).map((role) =>
        typeof role === "string" ? role.trim() : "",
      ),
    ),
  ).filter((role): role is string => role.length > 0);

  if (roles.length === 0) {
    throw new Error("At least one role is required");
  }

  const payload: Record<string, unknown> = {
    email: normalizeEmail(input.email),
    scope: input.scope,
    guild_id: input.guildId ?? null,
    house_id: input.houseId ?? null,
    role: roles.join(","),
    token,
    invited_by: input.invitedBy,
  };

  if (input.expiresAt instanceof Date) {
    payload.expires_at = input.expiresAt.toISOString();
  }

  const insert = svc.from("invites").insert(payload).select("*").single();
  const { data, error } = await insert;
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create invite");
  }

  return data as InviteRecord;
}

export async function getInviteByToken(token: string): Promise<InviteRecord | null> {
  if (!token) return null;
  const svc = getServiceSupabase();
  const { data, error } = await svc.from("invites").select("*").eq("token", token).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return data as InviteRecord;
}

export async function markInviteAccepted(inviteId: string): Promise<void> {
  const svc = getServiceSupabase();
  const { error } = await svc
    .from("invites")
    .update({ status: "ACCEPTED" })
    .eq("id", inviteId)
    .eq("status", "PENDING");
  if (error) {
    throw new Error(error.message);
  }
}
