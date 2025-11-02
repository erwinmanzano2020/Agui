import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "^/$",
  "^/welcome(?:/.*)?$",
  "^/signin(?:/.*)?$",
  "^/auth/callback(?:/.*)?$",
  "^/api/auth/session$",
  "^/_next(?:/.*)?$",
  "^/favicon\\.ico$",
  "^/robots\\.txt$",
  "^/sitemap\\.xml$",
  "^/healthz$",
];

const publicMatcher = new RegExp(PUBLIC_PATHS.join("|"));

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicMatcher.test(pathname)) {
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
