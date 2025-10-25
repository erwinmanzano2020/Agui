import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL } from "./env";
import { getSupabaseProjectRef } from "./supabase-auth-cookie";

type SessionCookiePayload = {
  currentSession?: {
    access_token?: string;
    refresh_token?: string;
  } | null;
  access_token?: string;
  refresh_token?: string;
};

type RestoredTokens = {
  accessToken: string;
  refreshToken: string;
};

function decodeCookieValue(rawValue: string): SessionCookiePayload | null {
  if (!rawValue) return null;

  let decoded = rawValue;
  if (rawValue.includes("%")) {
    try {
      decoded = decodeURIComponent(rawValue);
    } catch (error) {
      console.warn("Failed to decode Supabase session cookie", error);
      decoded = rawValue;
    }
  }

  try {
    return JSON.parse(decoded) as SessionCookiePayload;
  } catch (error) {
    console.warn("Failed to parse Supabase session cookie", error);
    return null;
  }
}

function extractTokens(payload: SessionCookiePayload | null): RestoredTokens | null {
  if (!payload) return null;

  const accessToken =
    typeof payload.access_token === "string" && payload.access_token
      ? payload.access_token
      : typeof payload.currentSession?.access_token === "string"
        ? payload.currentSession.access_token
        : null;

  const refreshToken =
    typeof payload.refresh_token === "string" && payload.refresh_token
      ? payload.refresh_token
      : typeof payload.currentSession?.refresh_token === "string"
        ? payload.currentSession.refresh_token
        : null;

  if (!accessToken || !refreshToken) {
    return null;
  }

  return { accessToken, refreshToken } satisfies RestoredTokens;
}

export async function createServerSupabaseClient(): Promise<SupabaseClient | null> {
  const url = NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      "Supabase not configured. Missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
    return null;
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    return client;
  }

  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(`sb-${projectRef}-auth-token`)?.value;
    const tokens = extractTokens(decodeCookieValue(cookieValue ?? ""));
    if (!tokens) {
      return client;
    }

    const { error } = await client.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
    if (error) {
      console.warn("Failed to restore Supabase session for server action", error);
    }
  } catch (error) {
    console.warn("Failed to hydrate Supabase session from cookies", error);
  }

  return client;
}
