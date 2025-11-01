// src/lib/supabase-ssr.ts
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import {
  buildSupabaseAuthCookie,
  buildSupabaseSignOutCookie,
  getSupabaseAuthCookieName,
} from "./supabase-auth-cookie";

export type CookieOptions = {
  domain?: string;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  expires?: Date | number;
};

type CookieAdapter = {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  remove(name: string, options: CookieOptions): void;
};

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

type CreateServerClientOptions = {
  cookies: CookieAdapter;
  headers?: Record<string, string | undefined>;
};

function decodeCookieValue(rawValue: string | undefined): SessionCookiePayload | null {
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

function persistSessionCookie(adapter: CookieAdapter, session: Session) {
  try {
    const cookie = buildSupabaseAuthCookie(session);
    adapter.set(cookie.name, cookie.value, cookie);
  } catch (error) {
    console.warn("Failed to persist Supabase session cookie", error);
  }
}

function clearSessionCookie(adapter: CookieAdapter) {
  const cookie = buildSupabaseSignOutCookie();
  if (!cookie) return;
  try {
    adapter.set(cookie.name, cookie.value, cookie);
  } catch (error) {
    console.warn("Failed to clear Supabase session cookie", error);
  }
}

export async function createServerClient<Database>(
  url: string,
  anonKey: string,
  options: CreateServerClientOptions
): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: Object.fromEntries(
        Object.entries(options.headers ?? {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value as string])
      ),
    },
  });

  const cookieName = getSupabaseAuthCookieName();
  if (cookieName) {
    const rawValue = options.cookies.get(cookieName);
    const tokens = extractTokens(decodeCookieValue(rawValue));
    if (tokens) {
      const { error } = await client.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (error) {
        console.warn("Failed to restore Supabase session", error);
      }
    }
  }

  if (cookieName) {
    client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        persistSessionCookie(options.cookies, session);
      } else {
        clearSessionCookie(options.cookies);
      }
    });
  }

  return client as SupabaseClient<Database>;
}

export type { SupabaseClient };
