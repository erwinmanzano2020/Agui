import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";

import { createServerSupabase } from "@/lib/auth/server";

export const dynamic = "force-dynamic"; // do not cache; we set cookies here

const ACCESS_COOKIE = "sb-access-token";
const REFRESH_COOKIE = "sb-refresh-token";
const PRESENCE_COOKIE = "sb-presence";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const isProd = process.env.NODE_ENV === "production";

const BASE_COOKIE: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  secure: isProd,
};

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

export async function POST(req: Request) {
  const jar = await cookies();
  const supabase = await createServerSupabase({ cookieStore: jar });

  const payload = (await req.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };

  let session: Session | null | undefined;

  if (payload.access_token && payload.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    if (error) {
      clearSessionCookies(jar);
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    session = data.session;
  } else {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    session = data.session;
  }

  if (!session || !session.access_token || !session.refresh_token) {
    clearSessionCookies(jar);
    return NextResponse.json({ ok: true, cleared: true });
  }

  persistSessionCookies(jar, session);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  clearSessionCookies(jar);

  const supabase = await createServerSupabase({ cookieStore: jar });
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
