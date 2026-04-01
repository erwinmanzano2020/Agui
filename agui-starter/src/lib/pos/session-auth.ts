import "server-only";

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, EmployeeRow, PosDeviceInsert, PosDeviceRow, PosOperatorCredentialInsert, PosOperatorCredentialRow, PosSessionInsert, PosSessionRow } from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export class PosSessionAuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "POS_SESSION_AUTH_ERROR", status = 400) {
    super(message);
    this.name = "PosSessionAuthError";
    this.code = code;
    this.status = status;
  }
}

type SessionAuthRepository = {
  getDeviceByCode(params: { houseId: string; deviceCode: string }): Promise<PosDeviceRow | null>;
  getOpenSessionForDevice(params: { houseId: string; deviceId: string }): Promise<PosSessionRow | null>;
  getSessionById(params: { houseId: string; sessionId: string }): Promise<PosSessionRow | null>;
  getEmployeeByQrIdentifier(params: { houseId: string; qrIdentifier: string }): Promise<EmployeeRow | null>;
  getCredentialByEntity(params: { houseId: string; entityId: string }): Promise<PosOperatorCredentialRow | null>;
  insertSession(payload: PosSessionInsert): Promise<PosSessionRow>;
  closeSession(payload: { houseId: string; sessionId: string; closedByEntityId: string; closedReason?: string | null }): Promise<PosSessionRow>;
  upsertDevice?(payload: PosDeviceInsert): Promise<PosDeviceRow>;
  upsertCredential?(payload: PosOperatorCredentialInsert): Promise<PosOperatorCredentialRow>;
};

type RepositoryClient = SessionAuthRepository | SupabaseClient<Database> | null | undefined;

function invalidCredentialsError() {
  return new PosSessionAuthError("Invalid operator credentials", "INVALID_OPERATOR_CREDENTIALS", 403);
}

function resolveRepository(client?: RepositoryClient): SessionAuthRepository {
  if (client && "getDeviceByCode" in client) {
    return client;
  }

  const supabase = (client as SupabaseClient<Database> | null | undefined) ?? createServiceSupabaseClient<Database>();

  return {
    async getDeviceByCode({ houseId, deviceCode }) {
      const { data, error } = await supabase
        .from("pos_devices")
        .select("*")
        .eq("house_id", houseId)
        .eq("device_code", deviceCode)
        .maybeSingle<PosDeviceRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "DEVICE_LOOKUP_FAILED", 500);
      return data ?? null;
    },
    async getOpenSessionForDevice({ houseId, deviceId }) {
      const { data, error } = await supabase
        .from("pos_sessions")
        .select("*")
        .eq("house_id", houseId)
        .eq("device_id", deviceId)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle<PosSessionRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "SESSION_LOOKUP_FAILED", 500);
      return data ?? null;
    },
    async getSessionById({ houseId, sessionId }) {
      const { data, error } = await supabase
        .from("pos_sessions")
        .select("*")
        .eq("house_id", houseId)
        .eq("id", sessionId)
        .maybeSingle<PosSessionRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "SESSION_LOOKUP_FAILED", 500);
      return data ?? null;
    },
    async getEmployeeByQrIdentifier({ houseId, qrIdentifier }) {
      const { data, error } = await supabase
        .from("employees")
        .select("id, house_id, code, entity_id, full_name, rate_per_day, status, branch_id, created_at, updated_at")
        .eq("house_id", houseId)
        .eq("code", qrIdentifier)
        .eq("status", "active")
        .maybeSingle<EmployeeRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "QR_LOOKUP_FAILED", 500);
      return data ?? null;
    },
    async getCredentialByEntity({ houseId, entityId }) {
      const { data, error } = await supabase
        .from("pos_operator_credentials")
        .select("*")
        .eq("house_id", houseId)
        .eq("entity_id", entityId)
        .eq("is_active", true)
        .maybeSingle<PosOperatorCredentialRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "CREDENTIAL_LOOKUP_FAILED", 500);
      return data ?? null;
    },
    async insertSession(payload) {
      const { data, error } = await supabase.from("pos_sessions").insert(payload).select("*").maybeSingle<PosSessionRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "SESSION_CREATE_FAILED", 500);
      if (!data) throw new PosSessionAuthError("Failed to create POS session", "SESSION_CREATE_FAILED", 500);
      return data;
    },
    async closeSession({ houseId, sessionId, closedByEntityId, closedReason }) {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("pos_sessions")
        .update({
          status: "CLOSED",
          closed_by_entity_id: closedByEntityId,
          closed_at: now,
          close_reason: closedReason ?? null,
          updated_at: now,
        })
        .eq("house_id", houseId)
        .eq("id", sessionId)
        .eq("status", "OPEN")
        .select("*")
        .maybeSingle<PosSessionRow>();
      if (error) throw new PosSessionAuthError(error.message, error.code ?? "SESSION_CLOSE_FAILED", 500);
      if (!data) throw new PosSessionAuthError("POS session not found", "SESSION_NOT_FOUND", 404);
      return data;
    },
  } satisfies SessionAuthRepository;
}

function normalizeCode(value: string) {
  return value.trim();
}

export function hashPosPin(pin: string, salt?: string): { salt: string; hash: string } {
  const normalizedPin = pin.trim();
  if (!/^\d{4,8}$/.test(normalizedPin)) {
    throw new PosSessionAuthError("Invalid PIN format", "INVALID_PIN_FORMAT", 400);
  }
  const resolvedSalt = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(normalizedPin, resolvedSalt, 64).toString("hex");
  return { salt: resolvedSalt, hash };
}

export function verifyPosPin(input: { pin: string; salt: string; hash: string }) {
  const candidate = scryptSync(input.pin.trim(), input.salt, 64);
  const expected = Buffer.from(input.hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export async function openPosSessionWithQrAndPin(
  input: {
    houseId: string;
    branchId: string;
    deviceCode: string;
    qrIdentifier: string;
    pin: string;
    actorEntityId: string;
  },
  client?: RepositoryClient,
): Promise<PosSessionRow> {
  const repo = resolveRepository(client);

  const deviceCode = normalizeCode(input.deviceCode);
  const qrIdentifier = normalizeCode(input.qrIdentifier);
  const employee = await repo.getEmployeeByQrIdentifier({ houseId: input.houseId, qrIdentifier });
  if (!employee?.entity_id) {
    throw invalidCredentialsError();
  }

  const device = await repo.getDeviceByCode({ houseId: input.houseId, deviceCode });
  if (!device || device.status !== "ACTIVE") {
    throw new PosSessionAuthError("Device is unavailable", "DEVICE_UNAVAILABLE", 403);
  }

  if (device.branch_id !== input.branchId) {
    throw new PosSessionAuthError("Device scope is invalid", "DEVICE_SCOPE_DENIED", 403);
  }

  if (employee.branch_id && employee.branch_id !== device.branch_id) {
    throw invalidCredentialsError();
  }

  const credential = await repo.getCredentialByEntity({ houseId: input.houseId, entityId: employee.entity_id });
  if (!credential || !verifyPosPin({ pin: input.pin, salt: credential.pin_salt, hash: credential.pin_hash })) {
    throw invalidCredentialsError();
  }

  const activeSession = await repo.getOpenSessionForDevice({ houseId: input.houseId, deviceId: device.id });
  if (activeSession) {
    throw new PosSessionAuthError("Device already has an active session", "SESSION_ALREADY_OPEN", 409);
  }

  return repo.insertSession({
    house_id: input.houseId,
    branch_id: device.branch_id,
    device_id: device.id,
    operator_entity_id: employee.entity_id,
    opened_by_entity_id: input.actorEntityId,
    status: "OPEN",
  });
}

export async function closePosSession(
  input: { houseId: string; sessionId: string; actorEntityId: string; branchId: string; reason?: string | null },
  client?: RepositoryClient,
) {
  const repo = resolveRepository(client);
  const existing = await repo.getSessionById({ houseId: input.houseId, sessionId: input.sessionId });
  if (!existing || existing.status !== "OPEN") {
    throw new PosSessionAuthError("POS session not found", "SESSION_NOT_FOUND", 404);
  }

  if (existing.branch_id !== input.branchId) {
    throw new PosSessionAuthError("Session scope is invalid", "SESSION_SCOPE_DENIED", 403);
  }

  return repo.closeSession({
    houseId: input.houseId,
    sessionId: input.sessionId,
    closedByEntityId: input.actorEntityId,
    closedReason: input.reason,
  });
}

export function createInMemoryPosSessionRepository(initial?: Partial<{
  devices: PosDeviceRow[];
  sessions: PosSessionRow[];
  employees: EmployeeRow[];
  credentials: PosOperatorCredentialRow[];
}>): SessionAuthRepository & {
  devices: PosDeviceRow[];
  sessions: PosSessionRow[];
  employees: EmployeeRow[];
  credentials: PosOperatorCredentialRow[];
} {
  const devices = [...(initial?.devices ?? [])];
  const sessions = [...(initial?.sessions ?? [])];
  const employees = [...(initial?.employees ?? [])];
  const credentials = [...(initial?.credentials ?? [])];

  return {
    devices,
    sessions,
    employees,
    credentials,
    async getDeviceByCode({ houseId, deviceCode }) {
      return devices.find((row) => row.house_id === houseId && row.device_code === deviceCode) ?? null;
    },
    async getOpenSessionForDevice({ houseId, deviceId }) {
      return sessions.find((row) => row.house_id === houseId && row.device_id === deviceId && row.status === "OPEN") ?? null;
    },
    async getSessionById({ houseId, sessionId }) {
      return sessions.find((row) => row.house_id === houseId && row.id === sessionId) ?? null;
    },
    async getEmployeeByQrIdentifier({ houseId, qrIdentifier }) {
      return employees.find((row) => row.house_id === houseId && row.code === qrIdentifier && row.status === "active") ?? null;
    },
    async getCredentialByEntity({ houseId, entityId }) {
      return credentials.find((row) => row.house_id === houseId && row.entity_id === entityId && row.is_active) ?? null;
    },
    async insertSession(payload) {
      const now = new Date().toISOString();
      const row: PosSessionRow = {
        id: payload.id ?? `pos-session-${sessions.length + 1}`,
        house_id: payload.house_id,
        branch_id: payload.branch_id,
        device_id: payload.device_id,
        operator_entity_id: payload.operator_entity_id,
        opened_by_entity_id: payload.opened_by_entity_id,
        closed_by_entity_id: payload.closed_by_entity_id ?? null,
        status: payload.status ?? "OPEN",
        opened_at: payload.opened_at ?? now,
        closed_at: payload.closed_at ?? null,
        close_reason: payload.close_reason ?? null,
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
      };
      sessions.push(row);
      return row;
    },
    async closeSession({ houseId, sessionId, closedByEntityId, closedReason }) {
      const row = sessions.find((session) => session.house_id === houseId && session.id === sessionId && session.status === "OPEN");
      if (!row) {
        throw new PosSessionAuthError("POS session not found", "SESSION_NOT_FOUND", 404);
      }
      row.status = "CLOSED";
      row.closed_by_entity_id = closedByEntityId;
      row.closed_at = new Date().toISOString();
      row.close_reason = closedReason ?? null;
      row.updated_at = new Date().toISOString();
      return row;
    },
    async upsertDevice(payload) {
      const existing = devices.find((row) => row.house_id === payload.house_id && row.device_code === payload.device_code);
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, payload, { updated_at: now });
        return existing;
      }
      const row: PosDeviceRow = {
        id: payload.id ?? `pos-device-${devices.length + 1}`,
        house_id: payload.house_id,
        branch_id: payload.branch_id,
        label: payload.label,
        device_code: payload.device_code,
        status: payload.status ?? "ACTIVE",
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
      };
      devices.push(row);
      return row;
    },
    async upsertCredential(payload) {
      const existing = credentials.find((row) => row.house_id === payload.house_id && row.entity_id === payload.entity_id);
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, payload, { updated_at: now });
        return existing;
      }
      const row: PosOperatorCredentialRow = {
        id: payload.id ?? `pos-credential-${credentials.length + 1}`,
        house_id: payload.house_id,
        entity_id: payload.entity_id,
        pin_hash: payload.pin_hash,
        pin_salt: payload.pin_salt,
        is_active: payload.is_active ?? true,
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
      };
      credentials.push(row);
      return row;
    },
  };
}
