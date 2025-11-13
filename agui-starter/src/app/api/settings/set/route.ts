import { NextRequest, NextResponse } from "next/server";

import { setSetting } from "@/lib/settings/server";
import { ensureSettingsWriteAccess, SettingsAuthError } from "@/lib/settings/auth";
import type { SettingScope } from "@/lib/settings/catalog";
import type { SettingKey, SettingValueMap } from "@/lib/settings/catalog";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

type SetPayload = {
  key?: SettingKey;
  scope?: SettingScope;
  businessId?: string | null;
  branchId?: string | null;
  value?: SettingValueMap[SettingKey];
};

export async function POST(request: NextRequest) {
  let payload: SetPayload;
  try {
    payload = (await request.json()) as SetPayload;
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  if (!payload.key || !payload.scope || typeof payload.value === "undefined") {
    return jsonError("key, scope, and value are required", 400);
  }

  try {
    const actor = await ensureSettingsWriteAccess({
      scope: payload.scope,
      businessId: payload.businessId,
      branchId: payload.branchId,
    });
    await setSetting(
      {
        key: payload.key,
        scope: payload.scope,
        value: payload.value as SettingValueMap[typeof payload.key],
        businessId: payload.businessId,
        branchId: payload.branchId,
      },
      actor.entityId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SettingsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to update setting", error);
    return jsonError("Unable to update setting", 500);
  }
}
