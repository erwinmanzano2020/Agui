import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { canAccess, type FeatureInput, AppFeature } from "@/lib/auth/permissions";
import { getUserRoles } from "@/lib/auth/user-roles";

function resolveDestination(explicit?: string): string | null {
  if (explicit && explicit.startsWith("/")) {
    return explicit;
  }

  try {
    const headerList = headers();
    const nextUrl = headerList.get("next-url");
    if (nextUrl) {
      const parsed = new URL(nextUrl, "https://agui.local");
      return parsed.pathname + parsed.search;
    }
  } catch (error) {
    console.warn("Failed to resolve guard destination", error);
  }

  return null;
}

export async function hasFeatureAccess(feature: FeatureInput): Promise<boolean> {
  const roles = await getUserRoles();
  return canAccess(feature, roles);
}

export async function requireFeatureAccess(feature: FeatureInput, options?: { dest?: string }) {
  if (await hasFeatureAccess(feature)) {
    return;
  }

  const dest = resolveDestination(options?.dest);
  if (dest) {
    const params = new URLSearchParams({ dest });
    redirect(`/403?${params.toString()}`);
  }

  redirect("/403");
}

export async function requireFeatureAccessApi(feature: AppFeature) {
  if (await hasFeatureAccess(feature)) {
    return null;
  }

  return NextResponse.json({ error: "Forbidden", feature }, { status: 403 });
}
