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

async function postSession(session: Session) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync Supabase session (${response.status})`);
  }
}

async function deleteSession() {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error(`Failed to clear Supabase session (${response.status})`);
  }
}

/**
 * Sync the current Supabase session with the server via the auth session API.
 *
 * When a session is provided we use it directly; otherwise we resolve the
 * session from Supabase to minimize duplicate calls from event listeners.
 */
export async function syncSession(session?: Session | null) {
  let nextSession = session;

  if (typeof nextSession === "undefined") {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    nextSession = data.session ?? null;
  }

  if (nextSession) {
    await postSession(nextSession);
    return;
  }

  await deleteSession();
}

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${location.origin}/auth/callback` },
  });
}
