import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "../order-draft";

import {
  PosOrderLineError,
  addOrderLine,
  createInMemoryPosOrderLineRepository,
  getCurrentSessionOrderLines,
  removeOrderLine,
  updateOrderLine,
  type OrderLine,
} from "../order-line";

const baseHouseId = "house-1";
const baseBranchId = "branch-1";
const baseSessionId = "session-1";
const baseDeviceId = "device-1";
const baseOrderId = "order-1";
const baseLineId = "line-1";

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: baseSessionId,
    house_id: baseHouseId,
    branch_id: baseBranchId,
    device_id: baseDeviceId,
    operator_entity_id: "operator-1",
    opened_by_entity_id: "operator-1",
    closed_by_entity_id: null,
    status: "OPEN",
    opened_at: now,
    closed_at: null,
    close_reason: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeDraft(overrides: Partial<OrderDraft> = {}): OrderDraft {
  const now = new Date().toISOString();
  return {
    id: baseOrderId,
    house_id: baseHouseId,
    branch_id: baseBranchId,
    device_id: baseDeviceId,
    session_id: baseSessionId,
    operator_entity_id: "operator-1",
    status: "DRAFT",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  const now = new Date().toISOString();
  return {
    id: baseLineId,
    order_id: baseOrderId,
    house_id: baseHouseId,
    branch_id: baseBranchId,
    session_id: baseSessionId,
    operator_entity_id: "operator-1",
    item_code: "ITEM-001",
    quantity: 2,
    status: "ACTIVE",
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

test("reads current-session draft lines only for exact scoped order", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [
      makeLine({ id: "line-1", order_id: baseOrderId }),
      makeLine({ id: "line-2", order_id: "order-2" }),
      makeLine({ id: "line-3", branch_id: "branch-2" }),
      makeLine({ id: "line-4", status: "REMOVED" }),
    ],
  });

  const lines = await getCurrentSessionOrderLines(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      deviceId: baseDeviceId,
      orderId: baseOrderId,
    },
    repo,
  );

  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.id, "line-1");
});

test("update line is bounded to exact current-session draft scope", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [makeLine({ id: baseLineId, quantity: 1, item_code: "ITEM-OLD" })],
  });

  const updated = await updateOrderLine(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      deviceId: baseDeviceId,
      orderId: baseOrderId,
      lineId: baseLineId,
      operatorEntityId: "operator-2",
      itemCode: "  ITEM-NEW  ",
      quantity: 4,
    },
    repo,
  );

  assert.equal(updated.item_code, "ITEM-NEW");
  assert.equal(updated.quantity, 4);
  assert.equal(updated.operator_entity_id, "operator-2");
});

test("remove line deactivates exact scoped line only", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [makeLine({ id: baseLineId })],
  });

  const removed = await removeOrderLine(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      deviceId: baseDeviceId,
      orderId: baseOrderId,
      lineId: baseLineId,
      operatorEntityId: "operator-2",
    },
    repo,
  );

  assert.equal(removed.status, "REMOVED");
  assert.equal(removed.operator_entity_id, "operator-2");
});

test("line read/update/remove collapse invalid scope and missing cases to ORDER_INVALID_OR_CLOSED", async () => {
  const baseInput = {
    houseId: baseHouseId,
    branchId: baseBranchId,
    sessionId: baseSessionId,
    deviceId: baseDeviceId,
    orderId: baseOrderId,
  };

  const missingOrderRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [],
    lines: [makeLine()],
  });
  const wrongBranchRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft({ branch_id: "branch-2" })],
    lines: [makeLine()],
  });
  const wrongSessionRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession({ id: "session-2" })],
    orders: [makeDraft()],
    lines: [makeLine()],
  });
  const wrongDeviceRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession({ device_id: "device-2" })],
    orders: [makeDraft()],
    lines: [makeLine()],
  });
  const nonDraftRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft({ status: "CLOSED" as unknown as "DRAFT" })],
    lines: [makeLine()],
  });
  const closedSessionRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession({ status: "CLOSED" })],
    orders: [makeDraft()],
    lines: [makeLine()],
  });
  const missingLineRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [],
  });
  const wrongOrderLineRepo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [makeLine({ order_id: "order-2" })],
  });

  for (const repo of [missingOrderRepo, wrongBranchRepo, wrongSessionRepo, wrongDeviceRepo, nonDraftRepo, closedSessionRepo]) {
    const error = await captureOrderLineError(() => getCurrentSessionOrderLines({ ...baseInput }, repo));
    assert.equal(error.code, "ORDER_INVALID_OR_CLOSED");
  }

  for (const repo of [missingOrderRepo, wrongBranchRepo, wrongSessionRepo, wrongDeviceRepo, nonDraftRepo, closedSessionRepo, missingLineRepo, wrongOrderLineRepo]) {
    const updateError = await captureOrderLineError(() =>
      updateOrderLine({ ...baseInput, lineId: baseLineId, operatorEntityId: "operator-1", quantity: 2 }, repo),
    );
    const removeError = await captureOrderLineError(() =>
      removeOrderLine({ ...baseInput, lineId: baseLineId, operatorEntityId: "operator-1" }, repo),
    );
    assert.equal(updateError.code, "ORDER_INVALID_OR_CLOSED");
    assert.equal(removeError.code, "ORDER_INVALID_OR_CLOSED");
  }
});

test("update rejects invalid quantity and blank item code", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [makeLine()],
  });

  await assert.rejects(
    () =>
      updateOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          deviceId: baseDeviceId,
          orderId: baseOrderId,
          lineId: baseLineId,
          operatorEntityId: "operator-1",
          quantity: 0,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "INVALID_QUANTITY",
  );

  await assert.rejects(
    () =>
      updateOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          deviceId: baseDeviceId,
          orderId: baseOrderId,
          lineId: baseLineId,
          operatorEntityId: "operator-1",
          itemCode: "   ",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "ITEM_CODE_REQUIRED",
  );
});

test("update and remove reject missing operator attribution", async () => {
  const repo = createInMemoryPosOrderLineRepository({
    sessions: [makeSession()],
    orders: [makeDraft()],
    lines: [makeLine()],
  });

  await assert.rejects(
    () =>
      updateOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          deviceId: baseDeviceId,
          orderId: baseOrderId,
          lineId: baseLineId,
          operatorEntityId: "",
          quantity: 1,
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "OPERATOR_REQUIRED",
  );

  await assert.rejects(
    () =>
      removeOrderLine(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: baseSessionId,
          deviceId: baseDeviceId,
          orderId: baseOrderId,
          lineId: baseLineId,
          operatorEntityId: "",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderLineError && error.code === "OPERATOR_REQUIRED",
  );
});
