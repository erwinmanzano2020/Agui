import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import type { OrderDraft } from "../order-draft";
import {
  PosOrderLineError,
  createSupabasePosOrderLineRepository,
  getCurrentSessionOrderLines,
  removeOrderLine,
  updateOrderLine,
} from "../order-line";

type QueryState = {
  table: string;
  action: "select" | "update";
  filters: Array<{ column: string; value: unknown }>;
  updatePayload?: Record<string, unknown>;
};

type LineRow = {
  id: string;
  house_id: string;
  branch_id: string;
  session_id: string;
  device_id: string;
  order_id: string;
  item_code: string;
  quantity: number;
  operator_entity_id: string;
  status: "ACTIVE" | "REMOVED";
  created_at: string;
  updated_at: string;
};

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: "session-1",
    house_id: "house-1",
    branch_id: "branch-1",
    device_id: "device-1",
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
    id: "order-1",
    house_id: "house-1",
    branch_id: "branch-1",
    device_id: "device-1",
    session_id: "session-1",
    operator_entity_id: "operator-1",
    status: "DRAFT",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeLine(overrides: Partial<LineRow> = {}): LineRow {
  const now = new Date().toISOString();
  return {
    id: "line-1",
    house_id: "house-1",
    branch_id: "branch-1",
    session_id: "session-1",
    device_id: "device-1",
    order_id: "order-1",
    item_code: "ITEM-1",
    quantity: 1,
    operator_entity_id: "operator-1",
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function createFakeSupabase(params: {
  session: PosSessionRow | null;
  draft: OrderDraft | null;
  lines?: LineRow[];
}) {
  const calls: QueryState[] = [];

  return {
    calls,
    client: {
      from(table: string) {
        const state: QueryState = { table, action: "select", filters: [] };
        calls.push(state);

        const chain = {
          select() {
            return chain;
          },
          update(payload: Record<string, unknown>) {
            state.action = "update";
            state.updatePayload = payload;
            return chain;
          },
          eq(column: string, value: unknown) {
            state.filters.push({ column, value });
            return chain;
          },
          async maybeSingle<T>() {
            if (table === "pos_sessions") {
              return { data: params.session as T, error: null };
            }
            if (table === "pos_order_drafts") {
              const record = params.draft;
              const matches =
                record && state.filters.every((filter) => (record as Record<string, unknown>)[filter.column] === filter.value);
              return { data: (matches ? record : null) as T | null, error: null };
            }
            if (table === "pos_order_lines") {
              const match =
                params.lines?.find((line) =>
                  state.filters.every((filter) => (line as Record<string, unknown>)[filter.column] === filter.value),
                ) ?? null;
              if (!match) {
                return { data: null, error: null };
              }
              if (state.action === "update") {
                return { data: { ...match, ...(state.updatePayload ?? {}) } as T, error: null };
              }
              return { data: match as T, error: null };
            }
            return { data: null, error: null };
          },
          async then(resolve: (value: unknown) => unknown) {
            const values =
              params.lines?.filter((line) =>
                state.filters.every((filter) => (line as Record<string, unknown>)[filter.column] === filter.value),
              ) ?? [];
            return resolve({ data: values, error: null });
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

test("supabase read/update/remove include full scoped filters", async () => {
  const fake = createFakeSupabase({
    session: makeSession(),
    draft: makeDraft(),
    lines: [makeLine()],
  });

  const repo = createSupabasePosOrderLineRepository(fake.client as never);

  const lines = await getCurrentSessionOrderLines(
    {
      houseId: "house-1",
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
    },
    repo,
  );
  assert.equal(lines.length, 1);

  await updateOrderLine(
    {
      houseId: "house-1",
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
      lineId: "line-1",
      operatorEntityId: "operator-2",
      itemCode: "ITEM-2",
      quantity: 3,
    },
    repo,
  );

  await removeOrderLine(
    {
      houseId: "house-1",
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
      lineId: "line-1",
      operatorEntityId: "operator-2",
    },
    repo,
  );

  const lineLookup = fake.calls.find((call) => call.table === "pos_order_lines" && call.action === "select");
  assert.ok(lineLookup);
  assert.deepEqual(lineLookup.filters, [
    { column: "house_id", value: "house-1" },
    { column: "branch_id", value: "branch-1" },
    { column: "session_id", value: "session-1" },
    { column: "device_id", value: "device-1" },
    { column: "order_id", value: "order-1" },
    { column: "status", value: "ACTIVE" },
  ]);

  const updates = fake.calls.filter((call) => call.table === "pos_order_lines" && call.action === "update");
  assert.equal(updates.length, 2);

  for (const updateCall of updates) {
    assert.deepEqual(updateCall.filters, [
      { column: "house_id", value: "house-1" },
      { column: "branch_id", value: "branch-1" },
      { column: "session_id", value: "session-1" },
      { column: "device_id", value: "device-1" },
      { column: "order_id", value: "order-1" },
      { column: "id", value: "line-1" },
      { column: "status", value: "ACTIVE" },
    ]);
  }
});

test("supabase line operations preserve ORDER_INVALID_OR_CLOSED no-leak behavior", async () => {
  const input = {
    houseId: "house-1",
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  };

  const closedSessionRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession({ status: "CLOSED" }), draft: makeDraft(), lines: [makeLine()] }).client as never,
  );
  const missingDraftRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession(), draft: null, lines: [makeLine()] }).client as never,
  );
  const missingLineRepo = createSupabasePosOrderLineRepository(
    createFakeSupabase({ session: makeSession(), draft: makeDraft(), lines: [] }).client as never,
  );

  const closedSessionError = await captureOrderLineError(() => getCurrentSessionOrderLines(input, closedSessionRepo));
  const missingDraftError = await captureOrderLineError(() => getCurrentSessionOrderLines(input, missingDraftRepo));
  const missingLineUpdateError = await captureOrderLineError(() =>
    updateOrderLine({ ...input, lineId: "line-1", operatorEntityId: "operator-2", quantity: 2 }, missingLineRepo),
  );
  const missingLineRemoveError = await captureOrderLineError(() =>
    removeOrderLine({ ...input, lineId: "line-1", operatorEntityId: "operator-2" }, missingLineRepo),
  );

  assert.equal(closedSessionError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(missingDraftError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(missingLineUpdateError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(missingLineRemoveError.code, "ORDER_INVALID_OR_CLOSED");
});
