import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bootstrapPoliciesForSession } from "@/lib/policy/bootstrap";

export const dynamic = "force-dynamic";

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const PRESENCE_COOKIE = "sb-presence";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieStoreLike = CookieStore | Promise<CookieStore>;

const isProd = process.env.NODE_ENV === "production";

const BASE_COOKIE: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: isProd,
};

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === "object" && value !== null && typeof (value as PromiseLike<T>).then === "function";
}

async function ensureCookieStore(store: CookieStoreLike): Promise<CookieStore> {
  return isPromiseLike<CookieStore>(store) ? await store : store;
}

function setCookie(jar: CookieStore, name: string, value: string, options: Partial<CookieOptions> = {}) {
  jar.set({
    name,
    value,
    ...BASE_COOKIE,
    ...options,
  });
}

function clearCookie(jar: CookieStore, name: string) {
  jar.set({
    name,
    value: "",
    ...BASE_COOKIE,
    maxAge: 0,
  });
}

function persistSessionCookies(jar: CookieStore, session: Session) {
  const expiresIn = typeof session.expires_in === "number" ? session.expires_in : undefined;
  const refreshExpires = session.expires_at ? new Date(session.expires_at * 1000) : undefined;

  setCookie(jar, ACCESS_COOKIE, session.access_token, expiresIn ? { maxAge: expiresIn } : {});
  setCookie(jar, REFRESH_COOKIE, session.refresh_token!, refreshExpires ? { expires: refreshExpires } : {});
  setCookie(jar, PRESENCE_COOKIE, "1", expiresIn ? { maxAge: expiresIn } : {});
}

function clearSessionCookies(jar: CookieStore) {
  clearCookie(jar, ACCESS_COOKIE);
  clearCookie(jar, REFRESH_COOKIE);
  clearCookie(jar, PRESENCE_COOKIE);
}

function tokensFromHash(hash?: string | null) {
  if (!hash) return { accessToken: null, refreshToken: null };
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return {
    accessToken: accessToken && accessToken.length > 0 ? accessToken : null,
    refreshToken: refreshToken && refreshToken.length > 0 ? refreshToken : null,
  };
}

export async function POST(req: Request) {
  const cookieStore = cookies();
  const jar = await ensureCookieStore(cookieStore);
  const supabase = await createServerSupabaseClient({ cookieStore: jar, allowCookieWrite: true });

  const payload = (await req.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    hash?: string;
  };

  let accessToken = payload.access_token?.trim() || null;
  let refreshToken = payload.refresh_token?.trim() || null;

  if (!accessToken || !refreshToken) {
    const fromHash = tokensFromHash(payload.hash);
    accessToken = accessToken ?? fromHash.accessToken;
    refreshToken = refreshToken ?? fromHash.refreshToken;
  }

  let session: Session | null | undefined;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      clearSessionCookies(jar);
      return NextResponse.json({ ok: false, error: error?.message ?? "invalid_session" }, { status: 401 });
    }

    session = data.session;
  } else {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      clearSessionCookies(jar);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    session = data.session;
  }

  if (!session || !session.access_token || !session.refresh_token) {
    clearSessionCookies(jar);
    return NextResponse.json({ ok: true, cleared: true });
  }

  persistSessionCookies(jar, session);
  await bootstrapPoliciesForSession(session);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = cookies();
  const jar = await ensureCookieStore(cookieStore);
  clearSessionCookies(jar);

  const supabase = await createServerSupabaseClient({ cookieStore: jar, allowCookieWrite: true });
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
