// src/lib/auth/server.ts
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions, type SupabaseClient } from "@supabase/ssr";
import { Database } from "@/lib/types/supabase";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

type HeaderStore = Awaited<ReturnType<typeof headers>>;

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore: CookieStore = await cookies();
  const headerStore: HeaderStore = await headers();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
      headers: {
        "x-forwarded-for": headerStore.get("x-forwarded-for") ?? undefined,
      },
    }
  );
}

export async function getServerSession() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return { supabase, session: data.session };
}
