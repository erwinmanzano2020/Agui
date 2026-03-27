import { AppFeature } from "@/lib/auth/permissions";

export const SCOPE_TYPES = ["platform", "guild", "house"] as const;
export type ScopeType = (typeof SCOPE_TYPES)[number];

export const AUTHORITY_KINDS = [
  "business",
  "module",
  "action",
  "operational_elevated",
] as const;
export type AuthorityKind = (typeof AUTHORITY_KINDS)[number];

export type ModuleFeature = `${AppFeature}`;

export const MODULE_FEATURES = Object.values(AppFeature) as readonly ModuleFeature[];

export const SCOPE_TO_ROLE_SCOPE = {
  platform: "PLATFORM",
  guild: "GUILD",
  house: "HOUSE",
} as const;
