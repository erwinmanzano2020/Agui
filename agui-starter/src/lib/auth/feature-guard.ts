import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  canAccess,
  canAccessAny,
  applyDevPermissionsOverride,
  type FeatureInput,
  AppFeature,
  resolveAccessibleFeatures,
} from "@/lib/auth/permissions";
import { getUserPermissions } from "@/lib/auth/user-permissions";

function normalizeFeatureInput(feature: FeatureInput): AppFeature[] {
  if (typeof feature === "string") {
    return [feature as AppFeature];
  }

  if (Symbol.iterator in Object(feature)) {
    return Array.from(feature as Iterable<AppFeature>);
  }

  return [];
}

function logGuardDenied(features: FeatureInput, dest?: string) {
  const featureList = normalizeFeatureInput(features);
  const summary = featureList.length > 0 ? featureList.join(",") : "<none>";
  const destInfo = dest ? ` dest=${dest}` : "";
  console.warn(`Feature guard denied for features=[${summary}]${destInfo}`);
}

/** Resolve current request path for redirects (server only). */
export async function resolveDestFromHeaders(): Promise<string> {
  try {
    const headerList = await headers();
    const raw = headerList.get("next-url") ?? headerList.get("referer") ?? "/";
    const parsed = new URL(raw, "https://agui.local");
    return parsed.pathname + parsed.search;
  } catch (error) {
    console.warn("Failed to resolve guard destination", error);
    return "/";
  }
}



export type FeatureAccessDebugSnapshot = {
  requiredFeatures: AppFeature[];
  resolvedFeatures: AppFeature[];
};

export async function getFeatureAccessDebugSnapshot(
  features: FeatureInput,
): Promise<FeatureAccessDebugSnapshot> {
  const requiredFeatures = normalizeFeatureInput(features);
  const permissions = await getUserPermissions();
  return {
    requiredFeatures,
    resolvedFeatures: resolveAccessibleFeatures(requiredFeatures, permissions),
  };
}

export async function hasFeatureAccess(feature: FeatureInput): Promise<boolean> {
  const permissions = await getUserPermissions();
  return canAccess(feature, permissions);
}

export async function hasAnyFeatureAccess(feature: FeatureInput): Promise<boolean> {
  const permissions = await getUserPermissions();
  return canAccessAny(feature, permissions);
}

export async function requireFeatureAccess(
  feature: FeatureInput,
  options?: { dest?: string }
) {
  const permissions = await getUserPermissions();
  if (canAccess(feature, applyDevPermissionsOverride(permissions))) {
    return;
  }

  const explicit = options?.dest;
  const dest = explicit && explicit.startsWith("/") ? explicit : await resolveDestFromHeaders();
  logGuardDenied(feature, dest);
  const params = new URLSearchParams({ dest });
  redirect(`/403?${params.toString()}`);
}

export async function requireFeatureAccessJson(feature: FeatureInput) {
  const permissions = await getUserPermissions();
  if (canAccess(feature, applyDevPermissionsOverride(permissions))) {
    return null;
  }

  logGuardDenied(feature);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireFeatureAccessApi(feature: AppFeature) {
  return requireFeatureAccessJson(feature);
}

export async function requireAnyFeatureAccessJson(features: FeatureInput) {
  const permissions = await getUserPermissions();
  if (canAccessAny(features, applyDevPermissionsOverride(permissions))) {
    return null;
  }

  logGuardDenied(features);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireAnyFeatureAccessApi(features: Iterable<AppFeature>) {
  return requireAnyFeatureAccessJson(features);
}

export async function requireAnyFeatureAccess(
  features: FeatureInput,
  options?: { dest?: string },
) {
  if (await hasAnyFeatureAccess(features)) {
    return;
  }

  const explicit = options?.dest;
  const dest = explicit && explicit.startsWith("/") ? explicit : await resolveDestFromHeaders();
  logGuardDenied(features, dest);
  const params = new URLSearchParams({ dest });
  redirect(`/403?${params.toString()}`);
}
