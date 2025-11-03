import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/welcome(?:\/.*)?$/,
  /^\/auth\/callback(?:\/.*)?$/,
  /^\/apply(?:\/.*)?$/,
  /^\/api\/auth\/session(?:\/.*)?$/,
  /^\/api\/public\/.*$/,
  /^\/_next\//,
  /^\/assets\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.webmanifest$/,
  /^\/healthz$/,
];

function isPublic(pathname: string) {
  return PUBLIC_ROUTES.some((pattern) => pattern.test(pathname));
}

function hasAuthCookie(request: NextRequest) {
  const cookies = request.cookies.getAll();
  if (cookies.length === 0) {
    return false;
  }

  return cookies.some((cookie) => {
    return (
      cookie.name === "sb-access-token" ||
      cookie.name === "sb-refresh-token" ||
      cookie.name === "sb-presence" ||
      cookie.name.endsWith("-auth-token")
    );
  });
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const publicRoute = isPublic(pathname);
  const authed = hasAuthCookie(request);

  if (!authed && !publicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    url.search = search;
    return NextResponse.redirect(url);
  }

  if (authed && pathname === "/welcome") {
    const url = request.nextUrl.clone();
    url.pathname = "/me";
    url.search = search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|map)$).*)",
  ],
};
