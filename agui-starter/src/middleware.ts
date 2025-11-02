import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/", "/welcome", "/signin", "/auth/callback", "/api/auth/session"] as const;
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/manifest.webmanifest",
  "/robots.txt",
  "/sitemap.xml",
  "/healthz",
]);

function isPublicPath(pathname: string) {
  if (PUBLIC_FILES.has(pathname)) {
    return true;
  }

  if (pathname.startsWith("/_next")) {
    return true;
  }

  for (const path of PUBLIC_PATHS) {
    if (pathname === path) {
      return true;
    }

    if (path !== "/" && pathname.startsWith(`${path}/`)) {
      return true;
    }
  }

  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession =
    request.cookies.has("sb-access-token") ||
    request.cookies.has("sb-refresh-token");

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
