import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/lib/types/supabase";

export const dynamic = "force-dynamic"; // do not cache; we set cookies here

const PRESENCE_COOKIE = "sb-presence";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function setPresenceCookie(
  jar: CookieStore,
  options: Partial<Pick<CookieOptions, "maxAge" | "expires">> = {},
) {
  jar.set({
    name: PRESENCE_COOKIE,
    value: "1",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    ...options,
  });
}

function clearPresenceCookie(jar: CookieStore) {
  jar.set({
    name: PRESENCE_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
}

async function createSupabaseServerClient(jar: CookieStore) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return jar.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          jar.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          jar.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };

  const jar = await cookies();
  const accessToken = payload.access_token;
  const refreshToken = payload.refresh_token;

  if (accessToken && refreshToken) {
    const supabase = await createSupabaseServerClient(jar);
    const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    const expiresIn = data.session?.expires_in;
    setPresenceCookie(jar, typeof expiresIn === "number" ? { maxAge: expiresIn } : {});
    return NextResponse.json({ ok: true });
  }

  setPresenceCookie(jar);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const jar = await cookies();
  clearPresenceCookie(jar);

  const supabase = await createSupabaseServerClient(jar);
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
