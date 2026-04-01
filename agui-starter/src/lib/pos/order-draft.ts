import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, PosSessionRow } from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export type OrderDraft = {
  id: string;
  house_id: string;
  branch_id: string;
  device_id: string;
  session_id: string;
  operator_entity_id: string;
  status: "DRAFT";
  created_at: string;
  updated_at: string;
};

export class PosOrderDraftError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_DRAFT_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderDraftError";
    this.code = code;
    this.status = status;
  }
}

type OrderDraftRepository = {
  getSessionById(params: { houseId: string; branchId: string; sessionId: string }): Promise<PosSessionRow | null>;
  insertOrderDraft(payload: OrderDraft): Promise<OrderDraft>;
};

export type RepositoryClient = OrderDraftRepository | SupabaseClient<Database> | null | undefined;

function sessionInvalidOrClosedError() {
  return new PosOrderDraftError("Session invalid or closed", "SESSION_INVALID_OR_CLOSED", 403);
}

function resolveRepository(client?: RepositoryClient): OrderDraftRepository {
  if (client && "insertOrderDraft" in client) {
    return client;
  }

  const supabase = (client as SupabaseClient<Database> | null | undefined) ?? createServiceSupabaseClient<Database>();

  return {
    async getSessionById({ houseId, branchId, sessionId }) {
      const { data, error } = await supabase
        .from("pos_sessions")
        .select("*")
        .eq("house_id", houseId)
        .eq("branch_id", branchId)
        .eq("id", sessionId)
        .maybeSingle<PosSessionRow>();
      if (error) {
        throw new PosOrderDraftError(error.message, error.code ?? "SESSION_LOOKUP_FAILED", 500);
      }
      return data ?? null;
    },
    async insertOrderDraft(payload) {
      const { data, error } = await supabase.from("pos_order_drafts").insert(payload).select("*").maybeSingle<OrderDraft>();
      if (error) {
        throw new PosOrderDraftError(error.message, error.code ?? "ORDER_DRAFT_CREATE_FAILED", 500);
      }
      if (!data) {
        throw new PosOrderDraftError("Failed to create order draft", "ORDER_DRAFT_CREATE_FAILED", 500);
      }
      return data;
    },
  } satisfies OrderDraftRepository;
}

function makeDraftOrderId() {
  return `order-draft-${randomUUID()}`;
}

export function createInMemoryPosOrderDraftRepository(initial?: Partial<{ sessions: PosSessionRow[]; drafts: OrderDraft[] }>) {
  const sessions = [...(initial?.sessions ?? [])];
  const drafts = [...(initial?.drafts ?? [])];

  return {
    sessions,
    drafts,
    async getSessionById({ houseId, branchId, sessionId }) {
      return sessions.find((session) => session.house_id === houseId && session.branch_id === branchId && session.id === sessionId) ?? null;
    },
    async insertOrderDraft(payload) {
      drafts.push(payload);
      return payload;
    },
  } satisfies OrderDraftRepository & { sessions: PosSessionRow[]; drafts: OrderDraft[] };
}

export async function createDraftOrder(
  input: {
    houseId: string;
    branchId: string;
    deviceId: string;
    sessionId: string;
    operatorEntityId: string;
  },
  repo?: RepositoryClient,
): Promise<OrderDraft> {
  if (!input.operatorEntityId?.trim()) {
    throw new PosOrderDraftError("Operator entity is required", "OPERATOR_REQUIRED", 400);
  }

  const repository = resolveRepository(repo);
  const session = await repository.getSessionById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
  });

  if (!session || session.status !== "OPEN" || session.device_id !== input.deviceId) {
    throw sessionInvalidOrClosedError();
  }

  const now = new Date().toISOString();
  const payload: OrderDraft = {
    id: makeDraftOrderId(),
    house_id: input.houseId,
    branch_id: input.branchId,
    device_id: input.deviceId,
    session_id: input.sessionId,
    operator_entity_id: input.operatorEntityId,
    status: "DRAFT",
    created_at: now,
    updated_at: now,
  };

  return repository.insertOrderDraft(payload);
}
