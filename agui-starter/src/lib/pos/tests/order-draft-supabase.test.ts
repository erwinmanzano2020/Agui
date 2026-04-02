import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import {
  PosOrderDraftError,
  createDraftOrder,
  createSupabasePosOrderDraftRepository,
  getCurrentSessionDraftOrder,
} from "../order-draft";

type QueryState = {
  table: string;
  filters: Array<{ column: string; value: unknown }>;
  insertPayload?: unknown;
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

function createFakeSupabase(params: {
  session: PosSessionRow | null;
  insertedDraft?: Record<string, unknown> | null;
  drafts?: Array<Record<string, unknown>>;
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
          async maybeSingle<T>() {
            if (table === "pos_sessions") {
              return { data: params.session as T, error: null };
            }
            if (table === "pos_order_drafts") {
              if (!state.insertPayload) {
                const match =
                  params.drafts?.find((draft) =>
                    state.filters.every((filter) => draft[filter.column] === filter.value),
                  ) ?? null;
                return { data: match as T, error: null };
              }
              const fallback = (state.insertPayload ? { id: randomUUID(), ...(state.insertPayload as object) } : null) as T;
              return { data: (params.insertedDraft as T | null) ?? fallback, error: null };
            }
            return { data: null, error: null };
          },
        };

        return chain;
      },
    },
  };
}

async function captureOrderDraftError(task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    assert.ok(error instanceof PosOrderDraftError);
    return error;
  }
  assert.fail("Expected PosOrderDraftError");
}

test("supabase repository inserts draft and scopes session lookup by house/branch/session", async () => {
  const fake = createFakeSupabase({ session: makeSession() });
  const repo = createSupabasePosOrderDraftRepository(fake.client as never);

  const draft = await createDraftOrder(
    {
      houseId: "house-1",
      branchId: "branch-1",
      deviceId: "device-1",
      sessionId: "session-1",
      operatorEntityId: "operator-1",
    },
    repo,
  );

  assert.equal(draft.house_id, "house-1");
  assert.equal(draft.branch_id, "branch-1");
  assert.equal(draft.device_id, "device-1");
  assert.equal(draft.session_id, "session-1");
  assert.equal(draft.operator_entity_id, "operator-1");

  const sessionLookup = fake.calls.find((call) => call.table === "pos_sessions");
  assert.ok(sessionLookup);
  assert.deepEqual(sessionLookup.filters, [
    { column: "house_id", value: "house-1" },
    { column: "branch_id", value: "branch-1" },
    { column: "id", value: "session-1" },
  ]);

  const draftInsert = fake.calls.find((call) => call.table === "pos_order_drafts");
  assert.ok(draftInsert);
  const payload = draftInsert.insertPayload as Record<string, unknown>;
  assert.equal(payload.id, undefined);
  assert.equal(payload.house_id, "house-1");
  assert.equal(payload.branch_id, "branch-1");
  assert.equal(payload.device_id, "device-1");
  assert.equal(payload.session_id, "session-1");
  assert.equal(payload.operator_entity_id, "operator-1");
  assert.equal(payload.status, "DRAFT");
  assert.match(draft.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test("supabase repository preserves no-leak error for session mismatch and closed session", async () => {
  const mismatchedSessionRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({ session: null }).client as never,
  );
  const closedSessionRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({ session: makeSession({ status: "CLOSED" }) }).client as never,
  );

  const mismatchError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: "house-1",
        branchId: "branch-1",
        deviceId: "device-1",
        sessionId: "session-1",
        operatorEntityId: "operator-1",
      },
      mismatchedSessionRepo,
    ),
  );

  const closedError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: "house-1",
        branchId: "branch-1",
        deviceId: "device-1",
        sessionId: "session-1",
        operatorEntityId: "operator-1",
      },
      closedSessionRepo,
    ),
  );

  assert.equal(mismatchError.code, "SESSION_INVALID_OR_CLOSED");
  assert.equal(closedError.code, "SESSION_INVALID_OR_CLOSED");
});

test("supabase repository reads current-session draft order with full scope filters", async () => {
  const fake = createFakeSupabase({
    session: makeSession(),
    drafts: [
      {
        id: "order-1",
        house_id: "house-1",
        branch_id: "branch-1",
        session_id: "session-1",
        device_id: "device-1",
        operator_entity_id: "operator-1",
        status: "DRAFT",
      },
    ],
  });
  const repo = createSupabasePosOrderDraftRepository(fake.client as never);

  const draft = await getCurrentSessionDraftOrder(
    {
      houseId: "house-1",
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
    },
    repo,
  );

  assert.equal(draft.id, "order-1");
  assert.equal(draft.status, "DRAFT");

  const orderLookup = fake.calls.find((call) => call.table === "pos_order_drafts" && !call.insertPayload);
  assert.ok(orderLookup);
  assert.deepEqual(orderLookup.filters, [
    { column: "house_id", value: "house-1" },
    { column: "branch_id", value: "branch-1" },
    { column: "session_id", value: "session-1" },
    { column: "device_id", value: "device-1" },
    { column: "id", value: "order-1" },
    { column: "status", value: "DRAFT" },
  ]);

  const sessionLookup = fake.calls.find((call) => call.table === "pos_sessions");
  assert.ok(sessionLookup);
  assert.deepEqual(sessionLookup.filters, [
    { column: "house_id", value: "house-1" },
    { column: "branch_id", value: "branch-1" },
    { column: "id", value: "session-1" },
  ]);
});

test("supabase current-session draft read preserves ORDER_INVALID_OR_CLOSED no-leak behavior", async () => {
  const baseInput = {
    houseId: "house-1",
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
  };

  const missingRepo = createSupabasePosOrderDraftRepository(createFakeSupabase({ session: makeSession(), drafts: [] }).client as never);
  const wrongBranchRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({
      session: makeSession(),
      drafts: [
        {
          id: "order-1",
          house_id: "house-1",
          branch_id: "branch-2",
          session_id: "session-1",
          device_id: "device-1",
          status: "DRAFT",
        },
      ],
    }).client as never,
  );
  const wrongSessionRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({
      session: makeSession(),
      drafts: [
        {
          id: "order-1",
          house_id: "house-1",
          branch_id: "branch-1",
          session_id: "session-2",
          device_id: "device-1",
          status: "DRAFT",
        },
      ],
    }).client as never,
  );
  const wrongDeviceRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({
      session: makeSession(),
      drafts: [
        {
          id: "order-1",
          house_id: "house-1",
          branch_id: "branch-1",
          session_id: "session-1",
          device_id: "device-2",
          status: "DRAFT",
        },
      ],
    }).client as never,
  );
  const nonDraftRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({
      session: makeSession(),
      drafts: [
        {
          id: "order-1",
          house_id: "house-1",
          branch_id: "branch-1",
          session_id: "session-1",
          device_id: "device-1",
          status: "CLOSED",
        },
      ],
    }).client as never,
  );
  const closedSessionRepo = createSupabasePosOrderDraftRepository(
    createFakeSupabase({
      session: makeSession({ status: "CLOSED" }),
      drafts: [
        {
          id: "order-1",
          house_id: "house-1",
          branch_id: "branch-1",
          session_id: "session-1",
          device_id: "device-1",
          status: "DRAFT",
        },
      ],
    }).client as never,
  );

  const missingError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, missingRepo),
  );
  const wrongBranchError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, wrongBranchRepo),
  );
  const wrongSessionError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, wrongSessionRepo),
  );
  const wrongDeviceError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, wrongDeviceRepo),
  );
  const nonDraftError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, nonDraftRepo),
  );
  const closedSessionError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-1" }, closedSessionRepo),
  );

  assert.equal(missingError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongBranchError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongSessionError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongDeviceError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(nonDraftError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(closedSessionError.code, "ORDER_INVALID_OR_CLOSED");
});
