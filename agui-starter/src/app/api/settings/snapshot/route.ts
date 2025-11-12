import { NextResponse } from "next/server";

import { getSettingsSnapshot } from "@/lib/settings/server";
import { SETTINGS_CATALOG } from "@/lib/settings/catalog";
import { parseRoleFromHeaders, unauthorizedResponse } from "../_auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const businessId = searchParams.get("businessId");
  const branchId = searchParams.get("branchId");

  if (!category) {
    return NextResponse.json(
      { ok: false, error: "Missing category" },
      { status: 400 },
    );
  }

  const knownCategory = SETTINGS_CATALOG.some((entry) => entry.category === category);
  if (!knownCategory) {
    return NextResponse.json(
      { ok: false, error: `Unknown category ${category}` },
      { status: 400 },
    );
  }

  const role = parseRoleFromHeaders(request);
  if (!role) {
    return unauthorizedResponse("Missing or invalid role context", 401);
  }

  if (branchId && !businessId) {
    return NextResponse.json(
      { ok: false, error: "branchId requires businessId" },
      { status: 400 },
    );
  }

  if (role.role === "BUSINESS_ADMIN" && businessId && role.businessId !== businessId) {
    return unauthorizedResponse("Business mismatch");
  }

  if (role.role === "BRANCH_MANAGER") {
    if (businessId && role.businessId !== businessId) {
      return unauthorizedResponse("Business mismatch");
    }
    if (branchId && role.branchId !== branchId) {
      return unauthorizedResponse("Branch mismatch");
    }
  }

  try {
    const snapshot = await getSettingsSnapshot({
      category,
      businessId: businessId ?? undefined,
      branchId: branchId ?? undefined,
    });
    return NextResponse.json({ ok: true, data: snapshot });
  } catch (error) {
    console.error("settings snapshot error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
