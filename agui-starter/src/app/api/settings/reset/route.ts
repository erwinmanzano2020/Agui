import { NextRequest, NextResponse } from "next/server";

import { resetSettingToParent } from "@/lib/settings/server";
import { ensureSettingsWriteAccess, SettingsAuthError } from "@/lib/settings/auth";
import { emitEvent } from "@/lib/events/server";
import type { SettingScope, SettingKey } from "@/lib/settings/catalog";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

type ResetPayload = {
  key?: SettingKey;
  scope?: SettingScope;
  businessId?: string | null;
  branchId?: string | null;
};

export async function POST(request: NextRequest) {
  let payload: ResetPayload;
  try {
    payload = (await request.json()) as ResetPayload;
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  if (!payload.key || !payload.scope) {
    return jsonError("key and scope are required", 400);
  }

  if (payload.scope === "GM") {
    return jsonError("GM settings cannot be reset", 400);
  }

  try {
    const actor = await ensureSettingsWriteAccess({
      scope: payload.scope,
      businessId: payload.businessId,
      branchId: payload.branchId,
    });
    await resetSettingToParent(
      {
        key: payload.key,
        scope: payload.scope,
        businessId: payload.businessId,
        branchId: payload.branchId,
      },
      actor.entityId,
    );
    await emitEvent(`settings:scope:${payload.scope}`, "invalidate", {
      key: payload.key,
      scope: payload.scope,
      businessId: payload.businessId ?? null,
      branchId: payload.branchId ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SettingsAuthError) {
      return jsonError(error.message, error.status);
    }
    console.error("Failed to reset setting", error);
    return jsonError("Unable to reset setting", 500);
  }
}
