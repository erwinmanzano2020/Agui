import "server-only";

import { randomUUID } from "node:crypto";

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
  status: "ACTIVE";
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
  getOrderDraftById(params: { houseId: string; branchId: string; sessionId: string; orderId: string }): Promise<OrderDraft | null>;
  insertOrderLine(payload: OrderLine): Promise<OrderLine>;
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

export function createInMemoryPosOrderLineRepository(initial?: Partial<{ orders: OrderDraft[]; lines: OrderLine[] }>) {
  const orders = [...(initial?.orders ?? [])];
  const lines = [...(initial?.lines ?? [])];

  return {
    orders,
    lines,
    async getOrderDraftById({ houseId, branchId, sessionId, orderId }) {
      return (
        orders.find(
          (order) =>
            order.id === orderId &&
            order.house_id === houseId &&
            order.branch_id === branchId &&
            order.session_id === sessionId,
        ) ?? null
      );
    },
    async insertOrderLine(payload) {
      lines.push(payload);
      return payload;
    },
  } satisfies OrderLineRepository & { orders: OrderDraft[]; lines: OrderLine[] };
}

export async function addOrderLine(
  input: {
    houseId: string;
    branchId: string;
    sessionId: string;
    orderId: string;
    operatorEntityId: string;
    itemCode: string;
    quantity: number;
  },
  repo?: RepositoryClient,
): Promise<OrderLine> {
  if (!input.operatorEntityId?.trim()) {
    throw new PosOrderLineError("Operator entity is required", "OPERATOR_REQUIRED", 400);
  }

  if (!input.itemCode?.trim()) {
    throw new PosOrderLineError("Item code is required", "ITEM_CODE_REQUIRED", 400);
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new PosOrderLineError("Quantity must be a positive integer", "INVALID_QUANTITY", 400);
  }

  const repository = resolveRepository(repo);
  const order = await repository.getOrderDraftById({
    houseId: input.houseId,
    branchId: input.branchId,
    sessionId: input.sessionId,
    orderId: input.orderId,
  });

  if (!order || order.status !== "DRAFT") {
    throw orderInvalidOrClosedError();
  }

  const now = new Date().toISOString();
  const payload: OrderLine = {
    id: makeOrderLineId(),
    order_id: input.orderId,
    house_id: input.houseId,
    branch_id: input.branchId,
    session_id: input.sessionId,
    operator_entity_id: input.operatorEntityId,
    item_code: input.itemCode,
    quantity: input.quantity,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
  };

  return repository.insertOrderLine(payload);
}
