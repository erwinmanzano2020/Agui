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

test("returns current-session draft when house/branch/session/device/order all match", async () => {
  const now = new Date().toISOString();
  const repo = createInMemoryPosOrderDraftRepository({
    drafts: [
      {
        id: "order-1",
        house_id: baseHouseId,
        branch_id: baseBranchId,
        device_id: baseDeviceId,
        session_id: baseSessionId,
        operator_entity_id: "operator-1",
        status: "DRAFT",
        created_at: now,
        updated_at: now,
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

test("returns ORDER_INVALID_OR_CLOSED for missing, wrong-branch, wrong-session, wrong-device, and non-draft access", async () => {
  const now = new Date().toISOString();
  const makeScopedDraft = () => ({
    id: "order-1",
    house_id: baseHouseId,
    branch_id: baseBranchId,
    device_id: baseDeviceId,
    session_id: baseSessionId,
    operator_entity_id: "operator-1",
    status: "DRAFT" as const,
    created_at: now,
    updated_at: now,
  });

  const missingRepo = createInMemoryPosOrderDraftRepository();
  const wrongBranchRepo = createInMemoryPosOrderDraftRepository({
    drafts: [{ ...makeScopedDraft(), branch_id: "branch-2" }],
  });
  const wrongSessionRepo = createInMemoryPosOrderDraftRepository({
    drafts: [{ ...makeScopedDraft(), session_id: "session-2" }],
  });
  const wrongDeviceRepo = createInMemoryPosOrderDraftRepository({
    drafts: [{ ...makeScopedDraft(), device_id: "device-2" }],
  });
  const nonDraftRepo = createInMemoryPosOrderDraftRepository({
    drafts: [{ ...makeScopedDraft(), status: "CLOSED" as never }],
  });

  const captureReadError = (repo: ReturnType<typeof createInMemoryPosOrderDraftRepository>) =>
    captureOrderDraftError(() =>
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

  const [missingError, wrongBranchError, wrongSessionError, wrongDeviceError, nonDraftError] = await Promise.all([
    captureReadError(missingRepo),
    captureReadError(wrongBranchRepo),
    captureReadError(wrongSessionRepo),
    captureReadError(wrongDeviceRepo),
    captureReadError(nonDraftRepo),
  ]);

  assert.equal(missingError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongBranchError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongSessionError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(wrongDeviceError.code, "ORDER_INVALID_OR_CLOSED");
  assert.equal(nonDraftError.code, "ORDER_INVALID_OR_CLOSED");
});
