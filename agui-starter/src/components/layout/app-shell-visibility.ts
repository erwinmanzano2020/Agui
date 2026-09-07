export function isPublicShellBypassPath(pathname: string | null): boolean {
  if (!pathname) return false;

  if (pathname === "/") return true;
  if (pathname.startsWith("/apply") || pathname.startsWith("/auth/")) return true;
  if (pathname === "/mini" || pathname.startsWith("/mini/")) return true;

  const kioskPathPattern = /^\/company\/[^/]+\/kiosk(?:\/.*)?$/;
  return kioskPathPattern.test(pathname);
}
