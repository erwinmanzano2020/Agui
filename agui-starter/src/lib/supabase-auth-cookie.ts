import type { Session } from "@supabase/supabase-js";

import { NEXT_PUBLIC_SUPABASE_URL } from "./env";

type CookieOptions = {
  name: string;
  value: string;
  maxAge?: number;
  path: string;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
};

export function getSupabaseProjectRef(): string | null {
  const url = NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return null;
  }

  try {
    const host = new URL(url).host;
    const [projectRef] = host.split(".");
    return projectRef || null;
  } catch {
    return null;
  }
}

export function getSupabaseAuthCookieName(): string | null {
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) {
    return null;
  }

  return `sb-${projectRef}-auth-token`;
}

export function buildSupabaseAuthCookieValue(session: Session): string {
  const payload = {
    currentSession: session,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  };

  return JSON.stringify(payload);
}

export function buildSupabaseAuthCookie(
  session: Session,
  overrides: Partial<Omit<CookieOptions, "name" | "value">> = {},
): CookieOptions {
  const name = getSupabaseAuthCookieName();
  if (!name) {
    throw new Error("Supabase project reference missing");
  }

  const secure = overrides.secure ?? process.env.NODE_ENV === "production";
  const maxAge = overrides.maxAge ?? session.expires_in ?? undefined;

  return {
    name,
    value: buildSupabaseAuthCookieValue(session),
    path: "/",
    httpOnly: overrides.httpOnly ?? true,
    sameSite: overrides.sameSite ?? "lax",
    secure,
    maxAge,
  } satisfies CookieOptions;
}

export function buildSupabaseSignOutCookie(): CookieOptions | null {
  const name = getSupabaseAuthCookieName();
  if (!name) {
    return null;
  }

  return {
    name,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  } satisfies CookieOptions;
}
