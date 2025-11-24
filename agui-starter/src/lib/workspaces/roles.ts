import type { WorkspaceRole } from "@/lib/tiles/types";

export function normalizeWorkspaceRole(role: string | null | undefined): WorkspaceRole {
  switch (role) {
    case "house_owner":
    case "business_owner":
    case "BUSINESS_OWNER":
      return "owner";
    case "house_manager":
    case "business_admin":
    case "business_manager":
    case "BUSINESS_ADMIN":
    case "BUSINESS_MANAGER":
      return "manager";
    case "house_staff":
    case "cashier":
    case "business_staff":
    case "BUSINESS_STAFF":
      return "staff";
    default:
      return "guest";
  }
}

export function workspaceRoleAllowsPos(role: WorkspaceRole): boolean {
  return role === "owner" || role === "manager" || role === "staff";
}
