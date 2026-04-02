import "server-only";

import { randomUUID } from "node:crypto";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "./order-draft";

export type OrderLine = {
  id: string;
  order_id: string;
  house_id: string;
  branch_id: string;
  session_id: string;
  operator_entity_id: string;
  item_code: string;
  quantity: number;
  status: "ACTIVE" | "REMOVED";
  created_at: string;
  updated_at: string;
};

export class PosOrderLineError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "ORDER_LINE_ERROR", status = 400) {
    super(message);
    this.name = "PosOrderLineError";
    this.code = code;
    this.status = status;
  }
}

type OrderLineRepository = {
  getSessionById(params: { houseId: string; branchId: string; sessionId: string }): Promise<PosSessionRow | null>;
  getOrderDraftById(params: {
    houseId: string;
    branchId: string;
    sessionId: string;
    orderId: string;
    deviceId?: string;
  }): Promise<OrderDraft | null>;
  getOrderLinesByDraft(params: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
  }): Promise<OrderLine[]>;
  insertOrderLine(payload: OrderLine): Promise<OrderLine>;
  updateOrderLine(params: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    lineId: string;
    operatorEntityId: string;
    itemCode?: string;
    quantity?: number;
  }): Promise<OrderLine | null>;
  removeOrderLine(params: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    lineId: string;
    operatorEntityId: string;
  }): Promise<OrderLine | null>;
};

export type RepositoryClient = OrderLineRepository | null | undefined;

function repositoryRequiredError() {
  return new PosOrderLineError("Order line repository is required", "ORDER_LINE_REPOSITORY_REQUIRED", 500);
}

function orderInvalidOrClosedError() {
  return new PosOrderLineError("Order invalid or closed", "ORDER_INVALID_OR_CLOSED", 403);
}

function resolveRepository(client?: RepositoryClient): OrderLineRepository {
  if (!client || !("insertOrderLine" in client)) {
    throw repositoryRequiredError();
  }

  return client;
}

function makeOrderLineId() {
  return `order-line-${randomUUID()}`;
}

export function createInMemoryPosOrderLineRepository(
  initial?: Partial<{ sessions: PosSessionRow[]; orders: OrderDraft[]; lines: OrderLine[] }>,
) {
  const sessions = [...(initial?.sessions ?? [])];
  const orders = [...(initial?.orders ?? [])];
  const lines = [...(initial?.lines ?? [])];

  return {
    sessions,
    orders,
    lines,
    async getSessionById({ houseId, branchId, sessionId }) {
      return (
        sessions.find((session) => session.house_id === houseId && session.branch_id === branchId && session.id === sessionId) ?? null
      );
    },
    async getOrderDraftById({ houseId, branchId, sessionId, deviceId, orderId }) {
      return (
        orders.find(
          (order) =>
            order.id === orderId &&
            order.house_id === houseId &&
            order.branch_id === branchId &&
            order.session_id === sessionId &&
            (deviceId === undefined || order.device_id === deviceId),
        ) ?? null
      );
    },
    async getOrderLinesByDraft({ houseId, branchId, sessionId, orderId }) {
      return lines.filter(
        (line) =>
          line.house_id === houseId &&
          line.branch_id === branchId &&
          line.session_id === sessionId &&
          line.order_id === orderId &&
          line.status === "ACTIVE",
      );
    },
    async insertOrderLine(payload) {
      lines.push(payload);
      return payload;
    },
    async updateOrderLine({ houseId, branchId, sessionId, orderId, lineId, operatorEntityId, itemCode, quantity }) {
      const line =
        lines.find(
          (entry) =>
            entry.id === lineId &&
            entry.house_id === houseId &&
            entry.branch_id === branchId &&
            entry.session_id === sessionId &&
            entry.order_id === orderId &&
            entry.status === "ACTIVE",
        ) ?? null;
      if (!line) {
        return null;
      }

      line.operator_entity_id = operatorEntityId;
      if (itemCode !== undefined) {
        line.item_code = itemCode;
      }
      if (quantity !== undefined) {
        line.quantity = quantity;
      }
      line.updated_at = new Date().toISOString();
      return line;
    },
    async removeOrderLine({ houseId, branchId, sessionId, orderId, lineId, operatorEntityId }) {
      const line =
        lines.find(
          (entry) =>
            entry.id === lineId &&
            entry.house_id === houseId &&
            entry.branch_id === branchId &&
            entry.session_id === sessionId &&
            entry.order_id === orderId &&
            entry.status === "ACTIVE",
        ) ?? null;
      if (!line) {
        return null;
      }

      line.operator_entity_id = operatorEntityId;
      line.status = "REMOVED";
      line.updated_at = new Date().toISOString();
      return line;
    },
  } satisfies OrderLineRepository & { sessions: PosSessionRow[]; orders: OrderDraft[]; lines: OrderLine[] };
}

function validateOperator(operatorEntityId: string) {
  if (!operatorEntityId?.trim()) {
    throw new PosOrderLineError("Operator entity is required", "OPERATOR_REQUIRED", 400);
  }
}

function normalizeItemCode(itemCode: string) {
  if (!itemCode?.trim()) {
    throw new PosOrderLineError("Item code is required", "ITEM_CODE_REQUIRED", 400);
  }
  return itemCode.trim();
}

function validateQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new PosOrderLineError("Quantity must be a positive integer", "INVALID_QUANTITY", 400);
  }
}

async function ensureScopedDraft(
  repository: OrderLineRepository,
  input: { houseId: string; branchId: string; sessionId: string; deviceId: string; orderId: string },
) {
  const session = await repository.getSessionById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
  });

  if (!session || session.status !== "OPEN" || session.device_id !== input.deviceId) {
    throw orderInvalidOrClosedError();
  }

  const order = await repository.getOrderDraftById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
    deviceId: input.deviceId,
    orderId: input.orderId,
  });

  if (!order || order.status !== "DRAFT") {
    throw orderInvalidOrClosedError();
  }
}

export async function addOrderLine(
  input: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    operatorEntityId: string;
    itemCode: string;
    quantity: number;
  },
  repo?: RepositoryClient,
): Promise<OrderLine> {
  validateOperator(input.operatorEntityId);
  const normalizedItemCode = normalizeItemCode(input.itemCode);
  validateQuantity(input.quantity);

  const repository = resolveRepository(repo);
  await ensureScopedDraft(repository, input);

  const now = new Date().toISOString();
  const payload: OrderLine = {
    id: makeOrderLineId(),
    order_id: input.orderId,
    house_id: input.houseId,
    branch_id: input.branchId,
    session_id: input.sessionId,
    operator_entity_id: input.operatorEntityId,
    item_code: normalizedItemCode,
    quantity: input.quantity,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
  };

  return repository.insertOrderLine(payload);
}

export async function getCurrentSessionOrderLines(
  input: { houseId: string; branchId: string; sessionId: string; deviceId: string; orderId: string },
  repo?: RepositoryClient,
): Promise<OrderLine[]> {
  const repository = resolveRepository(repo);
  await ensureScopedDraft(repository, input);

  return repository.getOrderLinesByDraft(input);
}

export async function updateOrderLine(
  input: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    lineId: string;
    operatorEntityId: string;
    itemCode?: string;
    quantity?: number;
  },
  repo?: RepositoryClient,
): Promise<OrderLine> {
  validateOperator(input.operatorEntityId);

  if (input.itemCode !== undefined) {
    input.itemCode = normalizeItemCode(input.itemCode);
  }
  if (input.quantity !== undefined) {
    validateQuantity(input.quantity);
  }

  const repository = resolveRepository(repo);
  await ensureScopedDraft(repository, input);

  const line = await repository.updateOrderLine(input);
  if (!line) {
    throw orderInvalidOrClosedError();
  }

  return line;
}

export async function removeOrderLine(
  input: {
    houseId: string;
    branchId: string;
    sessionId: string;
    deviceId: string;
    orderId: string;
    lineId: string;
    operatorEntityId: string;
  },
  repo?: RepositoryClient,
): Promise<OrderLine> {
  validateOperator(input.operatorEntityId);

  const repository = resolveRepository(repo);
  await ensureScopedDraft(repository, input);

  const line = await repository.removeOrderLine(input);
  if (!line) {
    throw orderInvalidOrClosedError();
  }

  return line;
}
