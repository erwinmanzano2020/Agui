// src/lib/auth/server.ts
import { cookies, headers } from "next/headers";
import { createServerClient, type CookieOptions, type SupabaseClient } from "@supabase/ssr";
import { Database } from "@/lib/types/supabase";

type MutableCookieStore = {
  set?: (name: string, value: string, options?: CookieOptions) => void;
  delete?: (name: string, options?: CookieOptions) => void;
};

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const mutableCookies = cookieStore as unknown as MutableCookieStore;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          if (typeof mutableCookies.set === "function") {
            mutableCookies.set(name, value, options);
          }
        },
        remove(name: string, options: CookieOptions) {
          if (typeof mutableCookies.delete === "function") {
            mutableCookies.delete(name, options);
          }
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
