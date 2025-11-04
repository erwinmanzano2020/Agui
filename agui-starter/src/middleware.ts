// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // short-circuit public routes
  if (isPublicPath(pathname)) return NextResponse.next();

  // If we already have sb access cookie, let it through
  // (cookie names follow Supabase convention; adjust if you prefixed them)
  const hasSession =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb:token") ||
    request.cookies.has("supabase-auth-token");

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)"],
};
