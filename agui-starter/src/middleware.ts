// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL } from "@/lib/env";
import { getSupabaseAuthCookieName } from "@/lib/supabase-auth-cookie";
import { createServerClient } from "@/lib/supabase-ssr";

// Public paths (no session required)
const PUBLIC_PATHS: (string | RegExp)[] = [
  "/",                 // landing
  "/welcome",          // magic-link entry
  "/auth/callback",    // email link lands here
  /^\/apply(\/.*)?$/,  // public apply flows
  /^\/enroll(\/.*)?$/, // public enroll flows
  /^\/api\/auth\/session$/,          // cookie sync endpoint
  /^\/api\/identity\/bootstrap$/,    // bootstrap identity
  /^\/api\/lookup\/resolve$/,        // new lookup API
  /^\/api\/identifiers\/link$/,      // allow POST; RLS guards auth/GM
  // Next.js runtime/asset paths
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/images\//,
  /^\/icons?\//,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) =>
    typeof p === "string" ? p === pathname : p.test(pathname)
  );
}

function cloneResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });
}

async function createMiddlewareSupabase(
  request: NextRequest,
  response: NextResponse,
): Promise<SupabaseClient<Database>> {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables");
  }

  return createServerClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value;
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
    headers: {
      "x-forwarded-for": request.headers.get("x-forwarded-for") ?? undefined,
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next({ request: { headers: request.headers } });

  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  const supabaseCookieName = getSupabaseAuthCookieName();
  const hasProjectScopedCookie = supabaseCookieName ? cookieNames.includes(supabaseCookieName) : false;
  const hasLegacySession =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb:token") ||
    request.cookies.has("supabase-auth-token");

  const hasSupabaseAuthToken = cookieNames.some((name) =>
    /^sb-[a-zA-Z0-9]+-auth-token$/.test(name),
  );

  console.debug("[middleware] auth cookie check", {
    hasSupabaseAuthToken,
    hasProjectScopedCookie,
    hasLegacySession,
    cookieCount: cookieNames.length,
  });

  let supabase: SupabaseClient<Database> | null = null;
  try {
    supabase = await createMiddlewareSupabase(request, response);
  } catch (error) {
    console.error("[middleware] failed to create Supabase client", error);
    return response;
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.warn("[middleware] auth.getSession failed", {
      code: (sessionError as { code?: string }).code ?? null,
      message: sessionError.message,
    });
  }

  if (!session && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = request.nextUrl.search;
    const redirectResponse = NextResponse.redirect(url);
    cloneResponseCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"],
};
