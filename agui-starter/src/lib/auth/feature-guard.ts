import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { canAccess, type FeatureInput, AppFeature } from "@/lib/auth/permissions";
import { getUserRoles } from "@/lib/auth/user-roles";

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

export async function hasFeatureAccess(feature: FeatureInput): Promise<boolean> {
  const roles = await getUserRoles();
  return canAccess(feature, roles);
}

export async function requireFeatureAccess(
  feature: FeatureInput,
  options?: { dest?: string }
) {
  if (await hasFeatureAccess(feature)) {
    return;
  }

  const explicit = options?.dest;
  const dest = explicit && explicit.startsWith("/") ? explicit : await resolveDestFromHeaders();
  const params = new URLSearchParams({ dest });
  redirect(`/403?${params.toString()}`);
}

export async function requireFeatureAccessJson(feature: FeatureInput) {
  if (await hasFeatureAccess(feature)) {
    return null;
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function requireFeatureAccessApi(feature: AppFeature) {
  return requireFeatureAccessJson(feature);
}
