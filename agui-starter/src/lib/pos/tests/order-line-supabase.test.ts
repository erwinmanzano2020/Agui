import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "../order-draft";
import {
  PosOrderLineError,
  addOrderLine,
  createSupabasePosOrderLineRepository,
  getCurrentSessionOrderLines,
  removeOrderLine,
  updateOrderLine,
  type OrderLine,
} from "../order-line";

type QueryState = {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  insertPayload?: unknown;
  updatePayload?: unknown;
};

const baseScope = {
  houseId: "house-1",
  branchId: "branch-1",
  sessionId: "session-1",
  deviceId: "device-1",
  orderId: "order-1",
};

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: baseScope.sessionId,
    house_id: baseScope.houseId,
    branch_id: baseScope.branchId,
    device_id: baseScope.deviceId,
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
    id: baseScope.orderId,
    house_id: baseScope.houseId,
    branch_id: baseScope.branchId,
    device_id: baseScope.deviceId,
    session_id: baseScope.sessionId,
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
    id: "line-1",
    order_id: baseScope.orderId,
    house_id: baseScope.houseId,
    branch_id: baseScope.branchId,
    session_id: baseScope.sessionId,
    device_id: baseScope.deviceId,
    operator_entity_id: "operator-1",
    item_code: "ITEM-001",
    quantity: 2,
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createFakeSupabase(params: {
  session: PosSessionRow | null;
  draft: OrderDraft | null;
  lines?: OrderLine[];
  insertedLine?: OrderLine | null;
  updatedLine?: OrderLine | null;
  removedLine?: OrderLine | null;
}) {
  const calls: QueryState[] = [];

  return {
    calls,
    client: {
      from(table: string) {
        const state: QueryState = { table, filters: [] };
        calls.push(state);

        const chain = {
          select() {
            return chain;
          },
          eq(column: string, value: unknown) {
            state.filters.push({ column, value });
            return chain;
          },
          insert(payload: unknown) {
            state.insertPayload = payload;
            return chain;
          },
          update(payload: unknown) {
            state.updatePayload = payload;
            return chain;
          },
          returns<T>() {
            return chain as unknown as Promise<{ data: T; error: null }>;
          },
          async maybeSingle<T>() {
            if (table === "pos_sessions") {
              return { data: params.session as T, error: null };
            }
            if (table === "pos_order_drafts") {
              return { data: params.draft as T, error: null };
            }
            if (table === "pos_order_lines" && state.insertPayload) {
              const inserted = (params.insertedLine as T | null) ?? ({ ...(state.insertPayload as object), id: "line-inserted" } as T);
              return { data: inserted, error: null };
            }
            if (table === "pos_order_lines" && state.updatePayload) {
              const payload = state.updatePayload as Partial<OrderLine>;
              const status = payload.status;
              const base = status === "REMOVED" ? params.removedLine : params.updatedLine;
              return { data: (base as T | null) ?? null, error: null };
            }
            return { data: null, error: null };
          },
          async then(onFulfilled: (value: { data: OrderLine[]; error: null }) => unknown) {
            if (table === "pos_order_lines") {
              const lineMatchesScope = (line: OrderLine) =>
                state.filters.every((filter) => (line as unknown as Record<string, unknown>)[filter.column] === filter.value);
              const scoped = (params.lines ?? []).filter(lineMatchesScope);
              return onFulfilled({ data: scoped, error: null });
            }
            return onFulfilled({ data: [], error: null });
          },
        };

        return chain;
      },
    },
  };
}

async function captureOrderLineError(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    assert.ok(error instanceof PosOrderLineError);
    return error;
  }
  assert.fail("Expected PosOrderLineError");
}

test("supabase repository persists and reads current-session lines with full scope filters", async () => {
  const line = makeLine();
  const fake = createFakeSupabase({
    session: makeSession(),
    draft: makeDraft(),
    lines: [line, makeLine({ id: "line-2", status: "REMOVED" })],
    insertedLine: line,
  });
  const repo = createSupabasePosOrderLineRepository(fake.client as never);

  const inserted = await addOrderLine(
    {
      ...baseScope,
      operatorEntityId: "operator-1",
      itemCode: "ITEM-001",
      quantity: 2,
    },
    repo,
  );

  assert.equal(inserted.device_id, baseScope.deviceId);

  const lines = await getCurrentSessionOrderLines(baseScope, repo);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.id, "line-1");

  const lineInsert = fake.calls.find((call) => call.table === "pos_order_lines" && call.insertPayload);
  assert.ok(lineInsert);
  assert.deepEqual(lineInsert.filters, []);
  const insertedPayload = lineInsert.insertPayload as Record<string, unknown>;
  assert.equal(insertedPayload.house_id, baseScope.houseId);
  assert.equal(insertedPayload.branch_id, baseScope.branchId);
  assert.equal(insertedPayload.session_id, baseScope.sessionId);
  assert.equal(insertedPayload.device_id, baseScope.deviceId);
  assert.equal(insertedPayload.order_id, baseScope.orderId);
  assert.equal(insertedPayload.operator_entity_id, "operator-1");

  const lineRead = fake.calls.find((call) => call.table === "pos_order_lines" && !call.insertPayload && !call.updatePayload);
  assert.ok(lineRead);
  assert.deepEqual(lineRead.filters, [
    { column: "house_id", value: baseScope.houseId },
    { column: "branch_id", value: baseScope.branchId },
    { column: "session_id", value: baseScope.sessionId },
    { column: "device_id", value: baseScope.deviceId },
    { column: "order_id", value: baseScope.orderId },
    { column: "status", value: "ACTIVE" },
  ]);
});

test("supabase update/remove include full bounded scope filters and conservative status discipline", async () => {
  const fake = createFakeSupabase({
    session: makeSession(),
    draft: makeDraft(),
    updatedLine: makeLine({ quantity: 4, item_code: "ITEM-NEW", operator_entity_id: "operator-2" }),
    removedLine: makeLine({ status: "REMOVED", operator_entity_id: "operator-3" }),
  });
  const repo = createSupabasePosOrderLineRepository(fake.client as never);

  const updated = await updateOrderLine(
    {
      ...baseScope,
      lineId: "line-1",
      operatorEntityId: "operator-2",
      itemCode: " ITEM-NEW ",
      quantity: 4,
    },
    repo,
  );
  assert.equal(updated.item_code, "ITEM-NEW");
  assert.equal(updated.quantity, 4);

  const removed = await removeOrderLine(
    {
      ...baseScope,
      lineId: "line-1",
      operatorEntityId: "operator-3",
    },
    repo,
  );
  assert.equal(removed.status, "REMOVED");

  const updates = fake.calls.filter((call) => call.table === "pos_order_lines" && call.updatePayload);
  assert.equal(updates.length, 2);

  const updateCall = updates[0] as QueryState;
  const removeCall = updates[1] as QueryState;

  assert.deepEqual(updateCall.filters, [
    { column: "house_id", value: baseScope.houseId },
    { column: "branch_id", value: baseScope.branchId },
    { column: "session_id", value: baseScope.sessionId },
    { column: "device_id", value: baseScope.deviceId },
    { column: "order_id", value: baseScope.orderId },
    { column: "id", value: "line-1" },
    { column: "status", value: "ACTIVE" },
  ]);

  assert.deepEqual(removeCall.filters, [
    { column: "house_id", value: baseScope.houseId },
    { column: "branch_id", value: baseScope.branchId },
    { column: "session_id", value: baseScope.sessionId },
    { column: "device_id", value: baseScope.deviceId },
    { column: "order_id", value: baseScope.orderId },
    { column: "id", value: "line-1" },
    { column: "status", value: "ACTIVE" },
  ]);

  assert.deepEqual(updateCall.updatePayload, {
    operator_entity_id: "operator-2",
    item_code: "ITEM-NEW",
    quantity: 4,
  });
  assert.deepEqual(removeCall.updatePayload, {
    status: "REMOVED",
    operator_entity_id: "operator-3",
  });
});

test("supabase missing or mismatched scope still collapses to ORDER_INVALID_OR_CLOSED", async () => {
  const noSessionRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: null, draft: makeDraft() }).client as never,
  );
  const noDraftRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession(), draft: null }).client as never,
  );
  const noUpdateMatchRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession(), draft: makeDraft(), updatedLine: null, removedLine: null }).client as never,
  );

  const addMissingScope = await captureOrderLineError(() =>
    addOrderLine({ ...baseScope, operatorEntityId: "operator-1", itemCode: "ITEM-001", quantity: 1 }, noSessionRepo),
  );
  const readMissingScope = await captureOrderLineError(() => getCurrentSessionOrderLines(baseScope, noDraftRepo));
  const updateMissingScope = await captureOrderLineError(() =>
    updateOrderLine({ ...baseScope, lineId: "line-1", operatorEntityId: "operator-1", quantity: 2 }, noUpdateMatchRepo),
  );
  const removeMissingScope = await captureOrderLineError(() =>
    removeOrderLine({ ...baseScope, lineId: "line-1", operatorEntityId: "operator-1" }, noUpdateMatchRepo),
  );

  assert.equal(addMissingScope.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(readMissingScope.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(updateMissingScope.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(removeMissingScope.code, "ORDER_INVALID_OR_CLOSED");
});

test("supabase order-line helpers preserve canonical validation errors", async () => {
  const repo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession(), draft: makeDraft(), insertedLine: makeLine() }).client as never,
  );

  const operatorError = await captureOrderLineError(() =>
    addOrderLine({ ...baseScope, operatorEntityId: "", itemCode: "ITEM-001", quantity: 1 }, repo),
  );
  const itemError = await captureOrderLineError(() =>
    addOrderLine({ ...baseScope, operatorEntityId: "operator-1", itemCode: " ", quantity: 1 }, repo),
  );
  const quantityError = await captureOrderLineError(() =>
    addOrderLine({ ...baseScope, operatorEntityId: "operator-1", itemCode: "ITEM-001", quantity: 0 }, repo),
  );

  assert.equal(operatorError.code, "OPERATOR_REQUIRED");
  assert.equal(itemError.code, "ITEM_CODE_REQUIRED");
  assert.equal(quantityError.code, "INVALID_QUANTITY");
});
