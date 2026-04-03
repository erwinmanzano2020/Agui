import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";

import * as authModule from "@/lib/auth/require-auth";
import * as posAccessModule from "@/lib/pos/access";
import * as orderDraftModule from "@/lib/pos/order-draft";
import * as orderLineModule from "@/lib/pos/order-line";

import {
  CLIENT_SAFE_POS_DRAFT_ERROR,
  CLIENT_SAFE_POS_ORDER_ERROR,
  addOrderLineAction,
  createDraftOrderAction,
  getCurrentSessionDraftOrderAction,
  getCurrentSessionOrderLinesAction,
  removeOrderLineAction,
  updateOrderLineAction,
} from "./order-actions";

const HOUSE_ID = "house-1";
const ACTOR_ENTITY_ID = "entity-manager";
const SLUG = "demo";

afterEach(() => {
  mock.restoreAll();
});

function mockAuthAndAccess() {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: HOUSE_ID, slug: SLUG } }),
        }),
      }),
    }),
  };

  mock.method(authModule, "requireAuth", async () => ({ supabase } as never));
  mock.method(posAccessModule, "requirePosAccess", async () => ({ entityId: ACTOR_ENTITY_ID } as never));

  return supabase;
}

test("createDraftOrderAction forwards exact current-session scope and actor attribution", async () => {
  const supabase = mockAuthAndAccess();
  const repo = { repo: "draft" };

  let received: Parameters<typeof orderDraftModule.createDraftOrder>[0] | null = null;
  mock.method(orderDraftModule, "createSupabasePosOrderDraftRepository", (arg: Parameters<typeof orderDraftModule.createSupabasePosOrderDraftRepository>[0]) => {
    assert.equal(arg, supabase as never);
    return repo as never;
  });
  mock.method(orderDraftModule, "createDraftOrder", async (input: Parameters<typeof orderDraftModule.createDraftOrder>[0], repository: Parameters<typeof orderDraftModule.createDraftOrder>[1]) => {
    received = input;
    assert.equal(repository, repo as never);
    return { id: "order-1" } as never;
  });

  const result = await createDraftOrderAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
  });

  assert.deepEqual(result, { ok: true, orderId: "order-1" });
  assert.deepEqual(received, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    operatorEntityId: ACTOR_ENTITY_ID,
  });
});

test("getCurrentSessionDraftOrderAction forwards exact current-session scope", async () => {
  const supabase = mockAuthAndAccess();
  const repo = { repo: "draft" };

  let received: Parameters<typeof orderDraftModule.getCurrentSessionDraftOrder>[0] | null = null;
  mock.method(orderDraftModule, "createSupabasePosOrderDraftRepository", (arg: Parameters<typeof orderDraftModule.createSupabasePosOrderDraftRepository>[0]) => {
    assert.equal(arg, supabase as never);
    return repo as never;
  });
  mock.method(
    orderDraftModule,
    "getCurrentSessionDraftOrder",
    async (
      input: Parameters<typeof orderDraftModule.getCurrentSessionDraftOrder>[0],
      repository: Parameters<typeof orderDraftModule.getCurrentSessionDraftOrder>[1],
    ) => {
    received = input;
    assert.equal(repository, repo as never);
    return {
      id: "order-1",
      house_id: HOUSE_ID,
      branch_id: "branch-1",
      session_id: "session-1",
      device_id: "device-1",
      operator_entity_id: ACTOR_ENTITY_ID,
      status: "DRAFT",
    } as never;
    },
  );

  const result = await getCurrentSessionDraftOrderAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.draft, {
      id: "order-1",
      houseId: HOUSE_ID,
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      operatorEntityId: ACTOR_ENTITY_ID,
      status: "DRAFT",
    });
  }

  assert.deepEqual(received, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  });
});

test("order-line actions forward exact scope and operator attribution", async () => {
  const supabase = mockAuthAndAccess();
  const repo = { repo: "line" };

  mock.method(orderLineModule, "createSupabasePosOrderLineRepository", (arg: Parameters<typeof orderLineModule.createSupabasePosOrderLineRepository>[0]) => {
    assert.equal(arg, supabase as never);
    return repo as never;
  });

  let addInput: Parameters<typeof orderLineModule.addOrderLine>[0] | null = null;
  mock.method(
    orderLineModule,
    "addOrderLine",
    async (input: Parameters<typeof orderLineModule.addOrderLine>[0], repository: Parameters<typeof orderLineModule.addOrderLine>[1]) => {
    addInput = input;
    assert.equal(repository, repo as never);
    return { id: "line-1" } as never;
    },
  );

  const addResult = await addOrderLineAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    itemCode: "ITEM-1",
    quantity: 2,
  });

  assert.deepEqual(addResult, { ok: true, lineId: "line-1" });
  assert.deepEqual(addInput, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    operatorEntityId: ACTOR_ENTITY_ID,
    itemCode: "ITEM-1",
    quantity: 2,
  });

  let readInput: Parameters<typeof orderLineModule.getCurrentSessionOrderLines>[0] | null = null;
  mock.method(
    orderLineModule,
    "getCurrentSessionOrderLines",
    async (
      input: Parameters<typeof orderLineModule.getCurrentSessionOrderLines>[0],
      repository: Parameters<typeof orderLineModule.getCurrentSessionOrderLines>[1],
    ) => {
    readInput = input;
    assert.equal(repository, repo as never);
    return [{ id: "line-1", order_id: "order-1", item_code: "ITEM-1", quantity: 2 }] as never;
    },
  );

  const linesResult = await getCurrentSessionOrderLinesAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  });

  assert.deepEqual(linesResult, {
    ok: true,
    lines: [{ id: "line-1", orderId: "order-1", itemCode: "ITEM-1", quantity: 2 }],
  });
  assert.deepEqual(readInput, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
  });

  let updateInput: Parameters<typeof orderLineModule.updateOrderLine>[0] | null = null;
  mock.method(
    orderLineModule,
    "updateOrderLine",
    async (input: Parameters<typeof orderLineModule.updateOrderLine>[0], repository: Parameters<typeof orderLineModule.updateOrderLine>[1]) => {
    updateInput = input;
    assert.equal(repository, repo as never);
    return { id: "line-1" } as never;
    },
  );

  const updateResult = await updateOrderLineAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    lineId: "line-1",
    itemCode: "ITEM-2",
    quantity: 3,
  });

  assert.deepEqual(updateResult, { ok: true, lineId: "line-1" });
  assert.deepEqual(updateInput, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    lineId: "line-1",
    operatorEntityId: ACTOR_ENTITY_ID,
    itemCode: "ITEM-2",
    quantity: 3,
  });

  let removeInput: Parameters<typeof orderLineModule.removeOrderLine>[0] | null = null;
  mock.method(
    orderLineModule,
    "removeOrderLine",
    async (input: Parameters<typeof orderLineModule.removeOrderLine>[0], repository: Parameters<typeof orderLineModule.removeOrderLine>[1]) => {
    removeInput = input;
    assert.equal(repository, repo as never);
    return { id: "line-1" } as never;
    },
  );

  const removeResult = await removeOrderLineAction(SLUG, {
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    lineId: "line-1",
  });

  assert.deepEqual(removeResult, { ok: true, lineId: "line-1" });
  assert.deepEqual(removeInput, {
    houseId: HOUSE_ID,
    branchId: "branch-1",
    sessionId: "session-1",
    deviceId: "device-1",
    orderId: "order-1",
    lineId: "line-1",
    operatorEntityId: ACTOR_ENTITY_ID,
  });
});

test("all draft helper failures map to one client-safe no-leak response", async () => {
  mockAuthAndAccess();
  mock.method(orderDraftModule, "createSupabasePosOrderDraftRepository", () => ({}) as never);

  for (const code of [
    "ORDER_INVALID_OR_CLOSED",
    "SESSION_INVALID_OR_CLOSED",
    "OPERATOR_REQUIRED",
    "ORDER_DRAFT_REPOSITORY_REQUIRED",
  ]) {
    mock.method(orderDraftModule, "createDraftOrder", async () => {
      throw new orderDraftModule.PosOrderDraftError("sensitive detail", code, 400);
    });

    const createResult = await createDraftOrderAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
    });
    assert.deepEqual(createResult, { ok: false, error: CLIENT_SAFE_POS_DRAFT_ERROR });

    mock.method(orderDraftModule, "getCurrentSessionDraftOrder", async () => {
      throw new orderDraftModule.PosOrderDraftError("sensitive detail", code, 403);
    });

    const getResult = await getCurrentSessionDraftOrderAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
    });
    assert.deepEqual(getResult, { ok: false, error: CLIENT_SAFE_POS_DRAFT_ERROR });

    mock.restoreAll();
    mockAuthAndAccess();
    mock.method(orderDraftModule, "createSupabasePosOrderDraftRepository", () => ({}) as never);
  }
});

test("all order-line helper failures map to one client-safe no-leak response", async () => {
  mockAuthAndAccess();
  mock.method(orderLineModule, "createSupabasePosOrderLineRepository", () => ({}) as never);

  for (const code of ["ORDER_INVALID_OR_CLOSED", "OPERATOR_REQUIRED", "ITEM_CODE_REQUIRED", "INVALID_QUANTITY"]) {
    mock.method(orderLineModule, "addOrderLine", async () => {
      throw new orderLineModule.PosOrderLineError("internal detail", code, 400);
    });

    const addResult = await addOrderLineAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
      itemCode: "ITEM",
      quantity: 2,
    });
    assert.deepEqual(addResult, { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR });

    mock.method(orderLineModule, "getCurrentSessionOrderLines", async () => {
      throw new orderLineModule.PosOrderLineError("internal detail", code, 403);
    });
    const readResult = await getCurrentSessionOrderLinesAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
    });
    assert.deepEqual(readResult, { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR });

    mock.method(orderLineModule, "updateOrderLine", async () => {
      throw new orderLineModule.PosOrderLineError("internal detail", code, 400);
    });
    const updateResult = await updateOrderLineAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
      lineId: "line-1",
      quantity: 4,
    });
    assert.deepEqual(updateResult, { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR });

    mock.method(orderLineModule, "removeOrderLine", async () => {
      throw new orderLineModule.PosOrderLineError("internal detail", code, 403);
    });
    const removeResult = await removeOrderLineAction(SLUG, {
      branchId: "branch-1",
      sessionId: "session-1",
      deviceId: "device-1",
      orderId: "order-1",
      lineId: "line-1",
    });
    assert.deepEqual(removeResult, { ok: false, error: CLIENT_SAFE_POS_ORDER_ERROR });

    mock.restoreAll();
    mockAuthAndAccess();
    mock.method(orderLineModule, "createSupabasePosOrderLineRepository", () => ({}) as never);
  }
});

test("unexpected helper failures are rethrown instead of converted to client-safe deny output", async () => {
  mockAuthAndAccess();
  mock.method(orderDraftModule, "createSupabasePosOrderDraftRepository", () => ({}) as never);
  mock.method(orderLineModule, "createSupabasePosOrderLineRepository", () => ({}) as never);

  mock.method(orderDraftModule, "createDraftOrder", async () => {
    throw new Error("unexpected draft infra failure");
  });
  await assert.rejects(
    () =>
      createDraftOrderAction(SLUG, {
        branchId: "branch-1",
        sessionId: "session-1",
        deviceId: "device-1",
      }),
    /unexpected draft infra failure/,
  );

  mock.method(orderLineModule, "addOrderLine", async () => {
    throw new Error("unexpected line infra failure");
  });
  await assert.rejects(
    () =>
      addOrderLineAction(SLUG, {
        branchId: "branch-1",
        sessionId: "session-1",
        deviceId: "device-1",
        orderId: "order-1",
        itemCode: "ITEM",
        quantity: 1,
      }),
    /unexpected line infra failure/,
  );
});

test("auth/access control-flow failures are preserved and not swallowed", async () => {
  mock.method(authModule, "requireAuth", async () => {
    throw new Error("NEXT_REDIRECT");
  });

  await assert.rejects(
    () =>
      createDraftOrderAction(SLUG, {
        branchId: "branch-1",
        sessionId: "session-1",
        deviceId: "device-1",
      }),
    /NEXT_REDIRECT/,
  );

  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: HOUSE_ID, slug: SLUG } }),
        }),
      }),
    }),
  };
  mock.restoreAll();
  mock.method(authModule, "requireAuth", async () => ({ supabase } as never));
  mock.method(posAccessModule, "requirePosAccess", async () => {
    throw new Error("POS_ACCESS_REDIRECT");
  });

  await assert.rejects(
    () =>
      getCurrentSessionOrderLinesAction(SLUG, {
        branchId: "branch-1",
        sessionId: "session-1",
        deviceId: "device-1",
        orderId: "order-1",
      }),
    /POS_ACCESS_REDIRECT/,
  );
});
