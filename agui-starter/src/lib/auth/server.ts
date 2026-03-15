// src/lib/auth/server.ts
import { cookies, headers } from "next/headers";

import type { Database } from "@/lib/db.types";
import { createServerClient, type CookieOptions, type SupabaseClient } from "@/lib/supabase-ssr";

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type HeaderStore = Awaited<ReturnType<typeof headers>>;

type MutableCookieStore = {
  set?: (name: string, value: string, options?: CookieOptions) => void;
  delete?: (name: string, options?: CookieOptions) => void;
};

type CookieStoreInput = CookieStore | Promise<CookieStore>;
type HeaderStoreInput = HeaderStore | Promise<HeaderStore>;

export interface CreateServerSupabaseOptions {
  cookieStore?: CookieStoreInput;
  headerStore?: HeaderStoreInput;
  allowCookieWrite?: boolean;
}

function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return typeof value === "object" && value !== null && typeof (value as PromiseLike<T>).then === "function";
}

async function resolveMaybePromise<T>(
  value: T | Promise<T> | undefined,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (typeof value !== "undefined") {
    return isPromiseLike<T>(value) ? await value : (value as T);
  }

  const resolvedFallback = fallback();
  return isPromiseLike<T>(resolvedFallback) ? await resolvedFallback : (resolvedFallback as T);
}

export type SupabaseServerClient = SupabaseClient<Database>;

// Canonical server-side Supabase factory used by `createServerSupabaseClient`.
// Prefer `createServerSupabaseClient` for server routes to keep SSR auth consistent.
export async function createServerSupabase(
  options: CreateServerSupabaseOptions = {},
): Promise<SupabaseServerClient> {
  const cookieStore = await resolveMaybePromise(options.cookieStore, cookies);
  const headerStore = await resolveMaybePromise(options.headerStore, headers);
  const allowCookieWrite = options.allowCookieWrite ?? false;

  const mutableCookies = cookieStore as unknown as MutableCookieStore;

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set:
          allowCookieWrite && typeof mutableCookies.set === "function"
            ? (name: string, value: string, options: CookieOptions) => {
                mutableCookies.set?.(name, value, options);
              }
            : undefined,
        remove:
          allowCookieWrite && typeof mutableCookies.delete === "function"
            ? (name: string, options: CookieOptions) => {
                mutableCookies.delete?.(name, options);
              }
            : undefined,
      },
      headers: {
        "x-forwarded-for": headerStore.get("x-forwarded-for") ?? undefined,
      },
    },
  );
}

export async function getServerSession() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return { supabase, session: data.session };
}
