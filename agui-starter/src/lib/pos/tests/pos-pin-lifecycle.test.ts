import assert from "node:assert/strict";
import test from "node:test";

import {
  PosSessionAuthError,
  createInMemoryPosSessionRepository,
  resetPosOperatorPin,
  resetPosPinAttemptTrackerForTests,
  rotatePosOperatorPin,
  setPosOperatorPin,
  verifyPosPin,
} from "../session-auth";

const baseHouseId = "house-1";
const baseEntityId = "entity-1";

async function captureError(task: () => Promise<unknown>): Promise<PosSessionAuthError> {
  try {
    await task();
  } catch (error) {
    assert.ok(error instanceof PosSessionAuthError);
    return error;
  }
  assert.fail("Expected PosSessionAuthError");
}

test.beforeEach(() => {
  resetPosPinAttemptTrackerForTests();
});

test("setPosOperatorPin creates credential with verifiable PIN", async () => {
  const repo = createInMemoryPosSessionRepository();

  const created = await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, repo);

  assert.equal(created.house_id, baseHouseId);
  assert.equal(created.entity_id, baseEntityId);
  assert.equal(repo.credentials.length, 1);
  assert.equal(verifyPosPin({ pin: "1234", salt: created.pin_salt, hash: created.pin_hash }), true);
});

test("resetPosOperatorPin overwrites existing credential", async () => {
  const repo = createInMemoryPosSessionRepository();
  await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, repo);

  const updated = await resetPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "5678" }, repo);

  assert.equal(repo.credentials.length, 1);
  assert.equal(verifyPosPin({ pin: "5678", salt: updated.pin_salt, hash: updated.pin_hash }), true);
  assert.equal(verifyPosPin({ pin: "1234", salt: updated.pin_salt, hash: updated.pin_hash }), false);
});

test("rotatePosOperatorPin updates PIN after validating current PIN", async () => {
  const repo = createInMemoryPosSessionRepository();
  await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, repo);

  const rotated = await rotatePosOperatorPin(
    { houseId: baseHouseId, entityId: baseEntityId, currentPin: "1234", newPin: "8765" },
    repo,
  );

  assert.equal(verifyPosPin({ pin: "8765", salt: rotated.pin_salt, hash: rotated.pin_hash }), true);
});

test("setPosOperatorPin rejects invalid PIN format", async () => {
  const repo = createInMemoryPosSessionRepository();

  await assert.rejects(
    () => setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "12ab" }, repo),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_PIN_FORMAT",
  );
});

test("rotatePosOperatorPin fails with wrong current PIN", async () => {
  const repo = createInMemoryPosSessionRepository();
  await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, repo);

  await assert.rejects(
    () =>
      rotatePosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, currentPin: "0000", newPin: "9999" }, repo),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_OPERATOR_CREDENTIALS",
  );
});

test("rotatePosOperatorPin keeps no-leak behavior for missing credential and wrong current PIN", async () => {
  const missingRepo = createInMemoryPosSessionRepository();
  const wrongPinRepo = createInMemoryPosSessionRepository();
  await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, wrongPinRepo);

  const missingError = await captureError(() =>
    rotatePosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, currentPin: "1234", newPin: "9999" }, missingRepo),
  );
  const wrongPinError = await captureError(() =>
    rotatePosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, currentPin: "0000", newPin: "9999" }, wrongPinRepo),
  );

  assert.equal(missingError.code, "INVALID_OPERATOR_CREDENTIALS");
  assert.equal(wrongPinError.code, "INVALID_OPERATOR_CREDENTIALS");
  assert.equal(missingError.message, wrongPinError.message);
});

test("rotatePosOperatorPin rate limits repeated failures per house/entity", async () => {
  const repo = createInMemoryPosSessionRepository();
  await setPosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, pin: "1234" }, repo);

  for (let i = 0; i < 5; i += 1) {
    await assert.rejects(
      () =>
        rotatePosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, currentPin: "0000", newPin: "9999" }, repo),
      (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_OPERATOR_CREDENTIALS",
    );
  }

  await assert.rejects(
    () =>
      rotatePosOperatorPin({ houseId: baseHouseId, entityId: baseEntityId, currentPin: "1234", newPin: "9999" }, repo),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_OPERATOR_CREDENTIALS",
  );
});
