import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set<string>([
  "/", // landing
  "/auth/callback",
  "/apply",
  "/api/auth/session",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/healthz",
]);

function isStaticPath(pathname: string) {
  return pathname.startsWith("/_next") || pathname.startsWith("/assets") || pathname.startsWith("/favicon");
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/public/");

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("sb-access-token")?.value);

  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|assets|favicon).*)"],
};
