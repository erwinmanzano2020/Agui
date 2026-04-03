"use server";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import {
  PosOrderDraftError,
  createDraftOrder,
  createSupabasePosOrderDraftRepository,
  getCurrentSessionDraftOrder,
} from "@/lib/pos/order-draft";
import {
  PosOrderLineError,
  addOrderLine,
  createSupabasePosOrderLineRepository,
  getCurrentSessionOrderLines,
  removeOrderLine,
  updateOrderLine,
} from "@/lib/pos/order-line";
import { CLIENT_SAFE_POS_DRAFT_ERROR, CLIENT_SAFE_POS_ORDER_ERROR } from "./order-action-errors";

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

  return { supabase, house, actorEntityId };
}

export async function createDraftOrderAction(
  slug: string,
  payload: { branchId: string; sessionId: string; deviceId: string },
) {
  const { supabase, house, actorEntityId } = await resolveHouseAndAccess(slug);
  const draftRepository = createSupabasePosOrderDraftRepository(supabase);

  try {
    const draft = await createDraftOrder(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        operatorEntityId: actorEntityId,
      },
      draftRepository,
    );

    return { ok: true, orderId: draft.id } as const;
  } catch (error) {
    if (!(error instanceof PosOrderDraftError)) {
      throw error;
    }

    console.warn("[pos-order] create draft denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_DRAFT_ERROR } as const;
  }
}

export async function getCurrentSessionDraftOrderAction(
  slug: string,
  payload: { branchId: string; sessionId: string; deviceId: string; orderId: string },
) {
  const { supabase, house } = await resolveHouseAndAccess(slug);
  const draftRepository = createSupabasePosOrderDraftRepository(supabase);

  try {
    const draft = await getCurrentSessionDraftOrder(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        orderId: payload.orderId,
      },
      draftRepository,
    );

    return {
      ok: true,
      draft: {
        id: draft.id,
        houseId: draft.house_id,
        branchId: draft.branch_id,
        sessionId: draft.session_id,
        deviceId: draft.device_id,
        operatorEntityId: draft.operator_entity_id,
        status: draft.status,
      },
    } as const;
  } catch (error) {
    if (!(error instanceof PosOrderDraftError)) {
      throw error;
    }

    console.warn("[pos-order] get draft denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_DRAFT_ERROR } as const;
  }
}

export async function addOrderLineAction(
  slug: string,
  payload: {
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    itemCode: string;
    quantity: number;
  },
) {
  const { supabase, house, actorEntityId } = await resolveHouseAndAccess(slug);
  const lineRepository = createSupabasePosOrderLineRepository(supabase);

  try {
    const line = await addOrderLine(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        orderId: payload.orderId,
        operatorEntityId: actorEntityId,
        itemCode: payload.itemCode,
        quantity: payload.quantity,
      },
      lineRepository,
    );

    return { ok: true, lineId: line.id } as const;
  } catch (error) {
    if (!(error instanceof PosOrderLineError)) {
      throw error;
    }

    console.warn("[pos-order] add line denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR } as const;
  }
}

export async function getCurrentSessionOrderLinesAction(
  slug: string,
  payload: { branchId: string; sessionId: string; deviceId: string; orderId: string },
) {
  const { supabase, house } = await resolveHouseAndAccess(slug);
  const lineRepository = createSupabasePosOrderLineRepository(supabase);

  try {
    const lines = await getCurrentSessionOrderLines(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        orderId: payload.orderId,
      },
      lineRepository,
    );

    return {
      ok: true,
      lines: lines.map((line) => ({
        id: line.id,
        orderId: line.order_id,
        itemCode: line.item_code,
        quantity: line.quantity,
      })),
    } as const;
  } catch (error) {
    if (!(error instanceof PosOrderLineError)) {
      throw error;
    }

    console.warn("[pos-order] list lines denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR } as const;
  }
}

export async function updateOrderLineAction(
  slug: string,
  payload: {
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    lineId: string;
    itemCode?: string;
    quantity?: number;
  },
) {
  const { supabase, house, actorEntityId } = await resolveHouseAndAccess(slug);
  const lineRepository = createSupabasePosOrderLineRepository(supabase);

  try {
    const line = await updateOrderLine(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        orderId: payload.orderId,
        lineId: payload.lineId,
        operatorEntityId: actorEntityId,
        itemCode: payload.itemCode,
        quantity: payload.quantity,
      },
      lineRepository,
    );

    return { ok: true, lineId: line.id } as const;
  } catch (error) {
    if (!(error instanceof PosOrderLineError)) {
      throw error;
    }

    console.warn("[pos-order] update line denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR } as const;
  }
}

export async function removeOrderLineAction(
  slug: string,
  payload: { branchId: string; sessionId: string; deviceId: string; orderId: string; lineId: string },
) {
  const { supabase, house, actorEntityId } = await resolveHouseAndAccess(slug);
  const lineRepository = createSupabasePosOrderLineRepository(supabase);

  try {
    const line = await removeOrderLine(
      {
        houseId: house.id,
        branchId: payload.branchId,
        sessionId: payload.sessionId,
        deviceId: payload.deviceId,
        orderId: payload.orderId,
        lineId: payload.lineId,
        operatorEntityId: actorEntityId,
      },
      lineRepository,
    );

    return { ok: true, lineId: line.id } as const;
  } catch (error) {
    if (!(error instanceof PosOrderLineError)) {
      throw error;
    }

    console.warn("[pos-order] remove line denied", { code: error.code, status: error.status, slug });
    return { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR } as const;
  }
}
