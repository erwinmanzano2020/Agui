import { NextResponse } from "next/server";

import { resetSettingToParent } from "@/lib/settings/server";
import {
  assertSettingKey,
  type SettingKey,
} from "@/lib/settings/catalog";
import type { SettingScope } from "@/lib/settings/types";
import { parseRoleFromHeaders, unauthorizedResponse } from "../_auth";

export async function POST(request: Request) {
  const role = parseRoleFromHeaders(request);
  if (!role) {
    return unauthorizedResponse("Missing or invalid role context", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("key" in payload) ||
    !("scope" in payload)
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing key/scope" },
      { status: 400 },
    );
  }

  const { key, scope, businessId, branchId } = payload as Record<string, unknown>;

  if (typeof key !== "string" || typeof scope !== "string") {
    return NextResponse.json(
      { ok: false, error: "Invalid key or scope" },
      { status: 400 },
    );
  }

  if (scope !== "GM" && scope !== "BUSINESS" && scope !== "BRANCH") {
    return NextResponse.json(
      { ok: false, error: "Unknown scope" },
      { status: 400 },
    );
  }

  try {
    assertSettingKey(key);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message },
      { status: 400 },
    );
  }

  const typedKey = key as SettingKey;
  const typedScope: SettingScope = scope;

  if (scope === "GM" && role.role !== "GM") {
    return unauthorizedResponse("Only GM may reset GM defaults");
  }

  if (scope === "BUSINESS") {
    if (!businessId || typeof businessId !== "string") {
      return NextResponse.json(
        { ok: false, error: "businessId is required for BUSINESS scope" },
        { status: 400 },
      );
    }
    if (role.role === "BRANCH_MANAGER") {
      return unauthorizedResponse(
        "Branch managers cannot modify BUSINESS scope settings",
      );
    }
    if (role.role === "BUSINESS_ADMIN" && role.businessId !== businessId) {
      return unauthorizedResponse("Business mismatch");
    }
  }

  if (scope === "BRANCH") {
    if (!businessId || typeof businessId !== "string" || !branchId || typeof branchId !== "string") {
      return NextResponse.json(
        { ok: false, error: "businessId and branchId are required for BRANCH scope" },
        { status: 400 },
      );
    }
    if (role.role === "BUSINESS_ADMIN" && role.businessId !== businessId) {
      return unauthorizedResponse("Business mismatch");
    }
    if (role.role === "BRANCH_MANAGER") {
      if (role.businessId !== businessId || role.branchId !== branchId) {
        return unauthorizedResponse("Branch mismatch");
      }
    }
  }

  try {
    await resetSettingToParent(
      {
        key: typedKey,
        scope: typedScope,
        businessId: typeof businessId === "string" ? businessId : undefined,
        branchId: typeof branchId === "string" ? branchId : undefined,
      },
      request.headers.get("x-actor-id"),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("settings reset error", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
