import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  /^\/welcome(?:$|\/)/,
  /^\/auth(?:$|\/)/,
  /^\/api(?:$|\/)/,
  /^\/signin(?:$|\/)/,
  /^\/signout(?:$|\/)/,
  /^\/accept-invite(?:$|\/)/,
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((pattern) => pattern.test(pathname));
  const hasSession = Boolean(
    request.cookies.get("sb-access-token") ||
      request.cookies.get("supabase-auth-token") ||
      request.cookies.get("sb-session")
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === "/welcome") {
    const url = request.nextUrl.clone();
    url.pathname = "/me";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  // Optional: land on /me when hitting /
  if (hasSession && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/me";
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
