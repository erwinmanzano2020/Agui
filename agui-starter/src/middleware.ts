// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/welcome",
  "/signin",
  "/auth/callback",
  "/(public)/auth/callback",
  "/api/auth/session",
  "/healthz",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;
  // (Optional) allow all API routes; uncomment if desired:
  // if (pathname.startsWith("/api/")) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // Basic auth gate: require sb-access-token cookie presence
  const hasSession =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb-refresh-token");

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    // preserve query
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Match all routes except static files/_next
export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
