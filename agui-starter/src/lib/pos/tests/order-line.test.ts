import assert from "node:assert/strict";
import test from "node:test";

import type { OrderDraft } from "../order-draft";

import { PosOrderLineError, addOrderLine, createInMemoryPosOrderLineRepository } from "../order-line";

const baseHouseId = "house-1";
const baseBranchId = "branch-1";
const baseSessionId = "session-1";
const baseOrderId = "order-1";

function makeDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  const now = new Date().toISOString();
  return {
    id: baseOrderId,
    house_id: baseHouseId,
    branch_id: baseBranchId,
    device_id: "device-1",
    session_id: baseSessionId,
    operator_entity_id: "operator-1",
    status: "DRAFT",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function captureOrderLineError(task: () => Promise<unknown>): Promise<PosOrderLineError> {
  try {
    await task();
  } catch (error) {
    assert.ok(error instanceof PosOrderLineError);
    return error;
  }

  assert.fail("Expected PosOrderLineError");
}

test("adds a single active line to a valid draft order", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  const line = await addOrderLine(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      orderId: baseOrderId,
      operatorEntityId: "operator-1",
      itemCode: "ITEM-001",
      quantity: 2,
    },
    repo,
  );

  assert.equal(line.order_id, baseOrderId);
  assert.equal(line.house_id, baseHouseId);
  assert.equal(line.branch_id, baseBranchId);
  assert.equal(line.session_id, baseSessionId);
  assert.equal(line.status, "ACTIVE");
  assert.equal(repo.lines.length, 1);
});

test("returns same no-leak error for missing order, wrong session, and wrong branch", async () => {
  const missingRepo = createInMemoryPosOrderLineRepository();
  const wrongSessionRepo = createInMemoryPosOrderLineRepository({ orders: [makeDraft({ session_id: "session-2" })] });
  const wrongBranchRepo = createInMemoryPosOrderLineRepository({ orders: [makeDraft({ branch_id: "branch-2" })] });

  const missingOrderError = await captureOrderLineError(() =>
    addOrderLine(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        sessionId: baseSessionId,
        orderId: baseOrderId,
        operatorEntityId: "operator-1",
        itemCode: "ITEM-001",
        quantity: 1,
      },
      missingRepo,
    ),
  );

  const wrongSessionError = await captureOrderLineError(() =>
    addOrderLine(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        sessionId: baseSessionId,
        orderId: baseOrderId,
        operatorEntityId: "operator-1",
        itemCode: "ITEM-001",
        quantity: 1,
      },
      wrongSessionRepo,
    ),
  );

  const wrongBranchError = await captureOrderLineError(() =>
    addOrderLine(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        sessionId: baseSessionId,
        orderId: baseOrderId,
        operatorEntityId: "operator-1",
        itemCode: "ITEM-001",
        quantity: 1,
      },
      wrongBranchRepo,
    ),
  );

  assert.equal(missingOrderError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongSessionError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongBranchError.code, "ORDER_INVALID_OR_CLOSED");
});

test("rejects line insertion when order is not in DRAFT status", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    orders: [{ ...makeDraft(), status: "CLOSED" as unknown as "DRAFT" }],
  });

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "operator-1",
          itemCode: "ITEM-001",
          quantity: 1,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "ORDER_INVALID_OR_CLOSED",
  );
});

test("rejects invalid quantity values", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "operator-1",
          itemCode: "ITEM-001",
          quantity: 0,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "INVALID_QUANTITY",
  );

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "operator-1",
          itemCode: "ITEM-001",
          quantity: 1.5,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "INVALID_QUANTITY",
  );
});

test("rejects empty item code", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "operator-1",
          itemCode: "",
          quantity: 1,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "ITEM_CODE_REQUIRED",
  );
});

test("rejects whitespace-only item code", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "operator-1",
          itemCode: "   ",
          quantity: 1,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "ITEM_CODE_REQUIRED",
  );
});

test("trims item code before storing order line", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  const line = await addOrderLine(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      orderId: baseOrderId,
      operatorEntityId: "operator-1",
      itemCode: "  ITEM-001  ",
      quantity: 1,
    },
    repo,
  );

  assert.equal(line.item_code, "ITEM-001");
});

test("rejects line insertion when operator attribution is missing", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  await assert.rejects(
    () =>
      addOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          orderId: baseOrderId,
          operatorEntityId: "",
          itemCode: "ITEM-001",
          quantity: 1,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "OPERATOR_REQUIRED",
  );
});

test("preserves operator attribution in inserted line", async () => {
  const repo = createInMemoryPosOrderLineRepository({ orders: [makeDraft()] });

  const line = await addOrderLine(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      orderId: baseOrderId,
      operatorEntityId: "operator-context-9",
      itemCode: "ITEM-001",
      quantity: 3,
    },
    repo,
  );

  assert.equal(line.operator_entity_id, "operator-context-9");
});
