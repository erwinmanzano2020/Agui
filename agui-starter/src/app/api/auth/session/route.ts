import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic"; // do not cache; we set cookies here

async function getServerSupabase(): Promise<SupabaseClient> {
  const jar = await cookies();

  return createServerClient(
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
  const { access_token, refresh_token } = (await req.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
  };

  if (!access_token || !refresh_token) {
    return NextResponse.json({ ok: false, error: "missing_tokens" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
