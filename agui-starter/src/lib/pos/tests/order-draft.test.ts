import assert from "node:assert/strict";
import test from "node:test";

import type { PosSessionRow } from "@/lib/db.types";

import {
  PosOrderDraftError,
  createDraftOrder,
  createInMemoryPosOrderDraftRepository,
  getCurrentSessionDraftOrder,
} from "../order-draft";

const baseHouseId = "house-1";
const baseBranchId = "branch-1";
const baseDeviceId = "device-1";
const baseSessionId = "session-1";

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

async function captureOrderDraftError(task: () => Promise<unknown>): Promise<PosOrderDraftError> {
  try {
    await task();
  } catch (error) {
    assert.ok(error instanceof PosOrderDraftError);
    return error;
  }
  assert.fail("Expected PosOrderDraftError");
}

test("creates draft with house/branch/device/session/operator lineage", async () => {
  const repo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession()] });

  const draft = await createDraftOrder(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      deviceId: baseDeviceId,
      sessionId: baseSessionId,
      operatorEntityId: "operator-1",
    },
    repo,
  );

  assert.equal(draft.house_id, baseHouseId);
  assert.equal(draft.branch_id, baseBranchId);
  assert.equal(draft.device_id, baseDeviceId);
  assert.equal(draft.session_id, baseSessionId);
  assert.equal(draft.operator_entity_id, "operator-1");
  assert.equal(draft.status, "DRAFT");
  assert.equal(repo.drafts.length, 1);
});

test("returns same no-leak error for missing and closed session", async () => {
  const missingRepo = createInMemoryPosOrderDraftRepository();
  const closedRepo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession({ status: "CLOSED" })] });

  const missingError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        deviceId: baseDeviceId,
        sessionId: baseSessionId,
        operatorEntityId: "operator-1",
      },
      missingRepo,
    ),
  );

  const closedError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        deviceId: baseDeviceId,
        sessionId: baseSessionId,
        operatorEntityId: "operator-1",
      },
      closedRepo,
    ),
  );

  assert.equal(missingError.code, "SESSION_INVALID_OR_CLOSED");
  assert.equal(closedError.code, "SESSION_INVALID_OR_CLOSED");
});

test("denies branch and device mismatch with same no-leak session error", async () => {
  const wrongBranchRepo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession({ branch_id: "branch-2" })] });
  const wrongDeviceRepo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession({ device_id: "device-2" })] });

  const wrongBranchError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        deviceId: baseDeviceId,
        sessionId: baseSessionId,
        operatorEntityId: "operator-1",
      },
      wrongBranchRepo,
    ),
  );

  const wrongDeviceError = await captureOrderDraftError(() =>
    createDraftOrder(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        deviceId: baseDeviceId,
        sessionId: baseSessionId,
        operatorEntityId: "operator-1",
      },
      wrongDeviceRepo,
    ),
  );

  assert.equal(wrongBranchError.code, "SESSION_INVALID_OR_CLOSED");
  assert.equal(wrongDeviceError.code, "SESSION_INVALID_OR_CLOSED");
});

test("rejects draft creation when operator attribution is missing", async () => {
  const repo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession()] });

  await assert.rejects(
    () =>
      createDraftOrder(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          deviceId: baseDeviceId,
          sessionId: baseSessionId,
          operatorEntityId: "",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosOrderDraftError && error.code === "OPERATOR_REQUIRED",
  );
});

test("preserves operator_entity_id attribution from input context", async () => {
  const repo = createInMemoryPosOrderDraftRepository({ sessions: [makeSession()] });

  const draft = await createDraftOrder(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      deviceId: baseDeviceId,
      sessionId: baseSessionId,
      operatorEntityId: "operator-context-9",
    },
    repo,
  );

  assert.equal(draft.operator_entity_id, "operator-context-9");
});

test("returns current-session draft only when scope and order id exactly match", async () => {
  const repo = createInMemoryPosOrderDraftRepository({
    sessions: [makeSession()],
    drafts: [
      {
        id: "order-1",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        session_id: baseSessionId,
        device_id: baseDeviceId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  });

  const draft = await getCurrentSessionDraftOrder(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: baseSessionId,
      deviceId: baseDeviceId,
      orderId: "order-1",
    },
    repo,
  );

  assert.equal(draft.id, "order-1");
  assert.equal(draft.status, "DRAFT");
});

test("returns ORDER_INVALID_OR_CLOSED for missing or out-of-scope/non-draft draft reads", async () => {
  const now = new Date().toISOString();
  const repo = createInMemoryPosOrderDraftRepository({
    sessions: [makeSession()],
    drafts: [
      {
        id: "order-wrong-branch",
        house_id: baseHouseId,
        branch_id: "branch-2",
        session_id: baseSessionId,
        device_id: baseDeviceId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
      },
      {
        id: "order-wrong-session",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        session_id: "session-2",
        device_id: baseDeviceId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
      },
      {
        id: "order-wrong-device",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        session_id: baseSessionId,
        device_id: "device-2",
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
      },
      {
        id: "order-non-draft",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        session_id: baseSessionId,
        device_id: baseDeviceId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
      } as never,
    ],
  });

  (repo.drafts.find((draft) => draft.id === "order-non-draft") as { status: string }).status = "CLOSED";

  const baseInput = {
    houseId: baseHouseId,
    branchId: baseBranchId,
    sessionId: baseSessionId,
    deviceId: baseDeviceId,
  };

  const missingError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "missing-order" }, repo),
  );
  const wrongBranchError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-wrong-branch" }, repo),
  );
  const wrongSessionError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-wrong-session" }, repo),
  );
  const wrongDeviceError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-wrong-device" }, repo),
  );
  const nonDraftError = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder({ ...baseInput, orderId: "order-non-draft" }, repo),
  );

  assert.equal(missingError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongBranchError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongSessionError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongDeviceError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(nonDraftError.code, "ORDER_INVALID_OR_CLOSED");
});

test("returns ORDER_INVALID_OR_CLOSED when matching draft exists but session is closed", async () => {
  const now = new Date().toISOString();
  const repo = createInMemoryPosOrderDraftRepository({
    sessions: [makeSession({ status: "CLOSED" })],
    drafts: [
      {
        id: "order-1",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        session_id: baseSessionId,
        device_id: baseDeviceId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
      },
    ],
  });

  const error = await captureOrderDraftError(() =>
    getCurrentSessionDraftOrder(
      {
        houseId: baseHouseId,
        branchId: baseBranchId,
        sessionId: baseSessionId,
        deviceId: baseDeviceId,
        orderId: "order-1",
      },
      repo,
    ),
  );

  assert.equal(error.code, "ORDER_INVALID_OR_CLOSED");
});
