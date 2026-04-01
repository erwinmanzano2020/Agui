import assert from "node:assert/strict";
import test from "node:test";

import type { EmployeeRow, PosDeviceRow, PosOperatorCredentialRow, PosSessionRow } from "@/lib/db.types";

import {
  PosSessionAuthError,
  closePosSession,
  createInMemoryPosSessionRepository,
  hashPosPin,
  openPosSessionWithQrAndPin,
} from "../session-auth";

const baseHouseId = "house-1";
const baseBranchId = "branch-1";

function makeDevice(overrides: Partial<PosDeviceRow> = {}): PosDeviceRow {
  const now = new Date().toISOString();
  return {
    id: "device-1",
    house_id: baseHouseId,
    branch_id: baseBranchId,
    label: "Front Counter",
    device_code: "DEV-001",
    status: "ACTIVE",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeEmployee(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: "emp-1",
    house_id: baseHouseId,
    code: "EMP-QR-001",
    entity_id: "entity-1",
    full_name: "Operator One",
    rate_per_day: 1000,
    status: "active",
    branch_id: baseBranchId,
    created_at: new Date().toISOString(),
    updated_at: null,
    ...overrides,
  };
}

function makeCredential(overrides: Partial<PosOperatorCredentialRow> = {}): PosOperatorCredentialRow {
  const now = new Date().toISOString();
  const hashed = hashPosPin("1234");
  return {
    id: "cred-1",
    house_id: baseHouseId,
    entity_id: "entity-1",
    pin_hash: hashed.hash,
    pin_salt: hashed.salt,
    is_active: true,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeSession(overrides: Partial<PosSessionRow> = {}): PosSessionRow {
  const now = new Date().toISOString();
  return {
    id: "session-1",
    house_id: baseHouseId,
    branch_id: baseBranchId,
    device_id: "device-1",
    operator_entity_id: "entity-1",
    opened_by_entity_id: "manager-1",
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

test("opens session with valid house/device/QR/PIN context", async () => {
  const repo = createInMemoryPosSessionRepository({
    devices: [makeDevice()],
    employees: [makeEmployee()],
    credentials: [makeCredential()],
  });

  const session = await openPosSessionWithQrAndPin({
    houseId: baseHouseId,
    branchId: baseBranchId,
    deviceCode: "DEV-001",
    qrIdentifier: "EMP-QR-001",
    pin: "1234",
    actorEntityId: "manager-1",
  }, repo);

  assert.equal(session.status, "OPEN");
  assert.equal(session.operator_entity_id, "entity-1");
  assert.equal(repo.sessions.length, 1);
});

test("denies QR-only sign-in when PIN is invalid", async () => {
  const repo = createInMemoryPosSessionRepository({
    devices: [makeDevice()],
    employees: [makeEmployee()],
    credentials: [makeCredential()],
  });

  await assert.rejects(
    () =>
      openPosSessionWithQrAndPin(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          deviceCode: "DEV-001",
          qrIdentifier: "EMP-QR-001",
          pin: "0000",
          actorEntityId: "manager-1",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_OPERATOR_CREDENTIALS",
  );

  assert.equal(repo.sessions.length, 0);
});

test("denies out-of-house lookup with no credential detail leakage", async () => {
  const repo = createInMemoryPosSessionRepository({
    devices: [makeDevice({ house_id: "house-2" })],
    employees: [makeEmployee({ house_id: "house-2" })],
    credentials: [makeCredential({ house_id: "house-2" })],
  });

  await assert.rejects(
    () =>
      openPosSessionWithQrAndPin(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          deviceCode: "DEV-001",
          qrIdentifier: "EMP-QR-001",
          pin: "1234",
          actorEntityId: "manager-1",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "INVALID_OPERATOR_CREDENTIALS",
  );
});

test("denies session open when device branch is outside requested branch scope", async () => {
  const repo = createInMemoryPosSessionRepository({
    devices: [makeDevice({ branch_id: "branch-2" })],
    employees: [makeEmployee()],
    credentials: [makeCredential()],
  });

  await assert.rejects(
    () =>
      openPosSessionWithQrAndPin(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          deviceCode: "DEV-001",
          qrIdentifier: "EMP-QR-001",
          pin: "1234",
          actorEntityId: "manager-1",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "DEVICE_SCOPE_DENIED",
  );
});

test("denies opening a second active session for the same device", async () => {
  const repo = createInMemoryPosSessionRepository({
    devices: [makeDevice()],
    employees: [makeEmployee()],
    credentials: [makeCredential()],
    sessions: [makeSession()],
  });

  await assert.rejects(
    () =>
      openPosSessionWithQrAndPin(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          deviceCode: "DEV-001",
          qrIdentifier: "EMP-QR-001",
          pin: "1234",
          actorEntityId: "manager-1",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "SESSION_ALREADY_OPEN",
  );
});

test("closes active session with attributable actor and safe scope checks", async () => {
  const repo = createInMemoryPosSessionRepository({
    sessions: [makeSession()],
  });

  const closed = await closePosSession(
    {
      houseId: baseHouseId,
      branchId: baseBranchId,
      sessionId: "session-1",
      actorEntityId: "manager-2",
      reason: "handoff",
    },
    repo,
  );

  assert.equal(closed.status, "CLOSED");
  assert.equal(closed.closed_by_entity_id, "manager-2");
  assert.equal(closed.close_reason, "handoff");
});

test("denies closing session when caller branch scope does not match", async () => {
  const repo = createInMemoryPosSessionRepository({
    sessions: [makeSession({ branch_id: "branch-2" })],
  });

  await assert.rejects(
    () =>
      closePosSession(
        {
          houseId: baseHouseId,
          branchId: baseBranchId,
          sessionId: "session-1",
          actorEntityId: "manager-2",
        },
        repo,
      ),
    (error: unknown) => error instanceof PosSessionAuthError && error.code === "SESSION_SCOPE_DENIED",
  );
});
