"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import { closePosSession, openPosSessionWithQrAndPin, PosSessionAuthError } from "@/lib/pos/session-auth";
import { mapPosSessionClientError } from "./error-messages";

async function resolveHouseAndAccess(slug: string) {
  const nextPath = `/company/${slug}/pos/session`;
  const { supabase } = await requireAuth(nextPath);
  const { data: house } = await supabase.from("houses").select("id, slug").eq("slug", slug).maybeSingle();
  if (!house) {
    throw new Error("House not found");
  }
  const decision = await requirePosAccess(supabase, house.id, { dest: nextPath });
  const actorEntityId = decision.entityId;
  if (!actorEntityId) {
    throw new Error("Missing POS actor identity");
  }

  return { house, actorEntityId };
}

export async function openPosSessionAction(
  slug: string,
  payload: { branchId: string; deviceCode: string; qrIdentifier: string; pin: string },
) {
  const { house, actorEntityId } = await resolveHouseAndAccess(slug);

  try {
    const session = await openPosSessionWithQrAndPin({
      houseId: house.id,
      branchId: payload.branchId,
      deviceCode: payload.deviceCode,
      qrIdentifier: payload.qrIdentifier,
      pin: payload.pin,
      actorEntityId,
    });

    return { ok: true, sessionId: session.id, deviceId: session.device_id } as const;
  } catch (error) {
    if (error instanceof PosSessionAuthError) {
      console.warn("[pos-session] open denied", { code: error.code, status: error.status, slug });
      return { ok: false, error: mapPosSessionClientError(error) } as const;
    }
    throw error;
  }
}

export async function closePosSessionAction(
  slug: string,
  payload: { branchId: string; sessionId: string; reason?: string | null },
) {
  const { house, actorEntityId } = await resolveHouseAndAccess(slug);

  try {
    const session = await closePosSession({
      houseId: house.id,
      branchId: payload.branchId,
      sessionId: payload.sessionId,
      actorEntityId,
      reason: payload.reason,
    });

    return { ok: true, sessionId: session.id } as const;
  } catch (error) {
    if (error instanceof PosSessionAuthError) {
      console.warn("[pos-session] close denied", { code: error.code, status: error.status, slug });
      return { ok: false, error: mapPosSessionClientError(error) } as const;
    }
    throw error;
  }
}
