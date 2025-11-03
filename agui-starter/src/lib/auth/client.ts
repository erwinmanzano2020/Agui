"use client";

import type { Session } from "@supabase/supabase-js";

import { getSupabase } from "@/lib/supabase";

const supabaseClient = getSupabase();

if (!supabaseClient) {
  throw new Error(
    "Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export const supabase = supabaseClient;

async function setServerSession(accessToken: string, refreshToken: string) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
    credentials: "include",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Failed to sync Supabase session (${response.status})`);
  }
}

async function clearServerSession() {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear Supabase session (${response.status})`);
  }
}

/** Call the server cookie bridge to set/refresh HttpOnly cookies. */
export async function syncSession(session?: Session | null) {
  let activeSession = session;

  if (typeof activeSession === "undefined") {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    activeSession = data.session;
  }

  const accessToken = activeSession?.access_token ?? null;
  const refreshToken = activeSession?.refresh_token ?? null;

  if (accessToken && refreshToken) {
    await setServerSession(accessToken, refreshToken);
    return;
  }

  await clearServerSession();
}

/** Send magic link to a public callback URL (no middleware redirect). */
export async function sendMagicLink(email: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/auth/callback` },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

/** Client sign-out + clear server cookies. */
export async function signOutEverywhere() {
  await supabase.auth.signOut();
  await clearServerSession();
}
