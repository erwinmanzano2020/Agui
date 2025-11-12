import { NextResponse } from "next/server";

type RoleContext =
  | { role: "GM" }
  | { role: "BUSINESS_ADMIN"; businessId: string }
  | { role: "BRANCH_MANAGER"; businessId: string; branchId: string };

type HeaderLike = Pick<Headers, "get">;

function extractHeaders(source: Request | HeaderLike): Headers | HeaderLike {
  if (source instanceof Request) {
    return source.headers;
  }
  return source;
}

export function parseRoleFromHeaders(source: Request | HeaderLike): RoleContext | null {
  const headers = extractHeaders(source);
  const roleHeader = headers.get("x-user-role")?.toUpperCase();
  if (!roleHeader) return null;

  switch (roleHeader) {
    case "GM":
      return { role: "GM" };
    case "BUSINESS_ADMIN": {
      const businessId = headers.get("x-business-id");
      if (!businessId) return null;
      return { role: "BUSINESS_ADMIN", businessId };
    }
    case "BRANCH_MANAGER": {
      const businessId = headers.get("x-business-id");
      const branchId = headers.get("x-branch-id");
      if (!businessId || !branchId) return null;
      return { role: "BRANCH_MANAGER", businessId, branchId };
    }
    default:
      return null;
  }
}

export function unauthorizedResponse(message: string, status = 403) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function ensureScopeAccess(
  ctx: RoleContext,
  scope: "GM" | "BUSINESS" | "BRANCH",
  businessId?: string | null,
  branchId?: string | null,
): boolean {
  if (ctx.role === "GM") return true;
  if (scope === "GM") {
    return false;
  }
  if (scope === "BUSINESS") {
    if (ctx.role === "BUSINESS_ADMIN") {
      return !businessId || ctx.businessId === businessId;
    }
    if (ctx.role === "BRANCH_MANAGER") {
      return ctx.businessId === businessId;
    }
  }
  if (scope === "BRANCH") {
    if (ctx.role === "BUSINESS_ADMIN") {
      return ctx.businessId === businessId;
    }
    if (ctx.role === "BRANCH_MANAGER") {
      return ctx.businessId === businessId && ctx.branchId === branchId;
    }
  }
  return false;
}

export type { RoleContext };
