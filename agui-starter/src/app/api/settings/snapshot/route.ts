import { NextRequest, NextResponse } from "next/server";

import { getSettingsSnapshot } from "@/lib/settings/server";
import { ensureSettingsReadAccess, SettingsAuthError } from "@/lib/settings/auth";
import { isSettingCategory, type SettingCategory, type SettingScope } from "@/lib/settings/catalog";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const categoryParam = url.searchParams.get("category");
  if (!isSettingCategory(categoryParam)) {
    return jsonError("category is required", 400);
  }
  const businessId = url.searchParams.get("businessId");
  const branchId = url.searchParams.get("branchId");
  const scope: SettingScope = branchId ? "BRANCH" : businessId ? "BUSINESS" : "GM";

  try {
    await ensureSettingsReadAccess({ scope, businessId, branchId });
    const snapshot = await getSettingsSnapshot({
      category: categoryParam as SettingCategory,
      businessId,
      branchId,
    });
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof SettingsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to load settings snapshot", error);
    return jsonError("Unable to load snapshot", 500);
  }
}
