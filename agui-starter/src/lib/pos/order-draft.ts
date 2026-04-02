import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, PosSessionRow } from "@/lib/db.types";

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
  getDraftOrderById(params: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
  }): Promise<OrderDraft | null>;
  insertOrderDraft(payload: Omit<OrderDraft, "id">): Promise<OrderDraft>;
};

export type RepositoryClient = OrderDraftRepository | null | undefined;

function sessionInvalidOrClosedError() {
  return new PosOrderDraftError("Session invalid or closed", "SESSION_INVALID_OR_CLOSED", 403);
}

function orderInvalidOrClosedError() {
  return new PosOrderDraftError("Order invalid or closed", "ORDER_INVALID_OR_CLOSED", 403);
}

function repositoryRequiredError() {
  return new PosOrderDraftError("Order draft repository is required", "ORDER_DRAFT_REPOSITORY_REQUIRED", 500);
}

function resolveRepository(client?: RepositoryClient): OrderDraftRepository {
  if (!client || !("insertOrderDraft" in client)) {
    throw repositoryRequiredError();
  }
  return client;
}

export function createSupabasePosOrderDraftRepository(supabase: SupabaseClient<Database>): OrderDraftRepository {
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
        throw new PosOrderDraftError(error.message, error.code ?? "ORDER_DRAFT_SESSION_LOOKUP_FAILED", 500);
      }
      return data ?? null;
    },
    async insertOrderDraft(payload) {
      const { data, error } = await supabase
        .from("pos_order_drafts")
        .insert(payload)
        .select("*")
        .maybeSingle<OrderDraft>();
      if (error) {
        throw new PosOrderDraftError(error.message, error.code ?? "ORDER_DRAFT_INSERT_FAILED", 500);
      }
      if (!data) {
        throw new PosOrderDraftError("Failed to create order draft", "ORDER_DRAFT_INSERT_FAILED", 500);
      }
      return data;
    },
    async getDraftOrderById({ houseId, branchId, sessionId, deviceId, orderId }) {
      const { data, error } = await supabase
        .from("pos_order_drafts")
        .select("*")
        .eq("house_id", houseId)
        .eq("branch_id", branchId)
        .eq("session_id", sessionId)
        .eq("device_id", deviceId)
        .eq("id", orderId)
        .eq("status", "DRAFT")
        .maybeSingle<OrderDraft>();
      if (error) {
        throw new PosOrderDraftError(error.message, error.code ?? "ORDER_DRAFT_LOOKUP_FAILED", 500);
      }
      return data ?? null;
    },
  } satisfies OrderDraftRepository;
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
      const draft = { ...payload, id: randomUUID() };
      drafts.push(draft);
      return draft;
    },
    async getDraftOrderById({ houseId, branchId, sessionId, deviceId, orderId }) {
      return (
        drafts.find(
          (draft) =>
            draft.house_id === houseId &&
            draft.branch_id === branchId &&
            draft.session_id === sessionId &&
            draft.device_id === deviceId &&
            draft.id === orderId &&
            draft.status === "DRAFT",
        ) ?? null
      );
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
  const payload: Omit<OrderDraft, "id"> = {
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

export async function getCurrentSessionDraftOrder(
  input: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
  },
  repo?: RepositoryClient,
): Promise<OrderDraft> {
  const repository = resolveRepository(repo);
  const session = await repository.getSessionById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
  });

  if (!session || session.status !== "OPEN" || session.device_id !== input.deviceId) {
    throw orderInvalidOrClosedError();
  }

  const draft = await repository.getDraftOrderById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    orderId: input.orderId,
  });

  if (!draft) {
    throw orderInvalidOrClosedError();
  }

  return draft;
}
