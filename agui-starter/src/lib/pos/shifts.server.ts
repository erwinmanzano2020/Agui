import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { emitEvent } from "@/lib/events/server";
import {
  currentEntityIsGM,
  getMyEntityId,
} from "@/lib/authz/server";
import type { Database, Json } from "@/lib/db.types";
import { getSettingsSnapshot } from "@/lib/settings/server";

import {
  calculateDenominationTotal,
  canCoverWithOveragePool,
  denominationMapToJson,
  determineVariance,
  normalizeDenominations,
} from "./shift-utils";

const MANAGER_ROLES = new Set([
  "owner",
  "manager",
  "branch_manager",
  "branch_supervisor",
  "branch_admin",
  "house_owner",
  "house_manager",
]);

const RESOLUTION_SHORT = new Set(["PAID_NOW", "PAYROLL_DEDUCT", "OVERAGE_OFFSET", "ESCALATED"]);
const RESOLUTION_OVER = new Set(["PAID_NOW", "ESCALATED", "OVERAGE_OFFSET"]);

export class PosShiftError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "pos_shift_error") {
    super(message);
    this.name = "PosShiftError";
    this.status = status;
    this.code = code;
  }
}

type Supabase = SupabaseClient<Database>;

type PosShiftRow = {
  id: string;
  house_id: string;
  branch_id: string;
  cashier_entity_id: string;
  opened_at: string;
  closed_at: string | null;
  verified_at: string | null;
  opening_float_json: Json;
  status: "OPEN" | "CLOSED" | "VERIFIED";
};

type ShiftSubmissionRow = {
  id: string;
  shift_id: string;
  submitted_by: string;
  submitted_at: string;
  denominations_json: Json;
  total_submitted: number;
  notes: string | null;
};

type OveragePoolRow = {
  id: string;
  branch_id: string;
  cashier_entity_id: string;
  balance_amount: number;
};

type PosSettings = {
  blindDropEnabled: boolean;
  overagePoolEnabled: boolean;
  overagePoolMaxRatio: number;
  floatDefaults: Record<string, number>;
};

type ActorContext = {
  supabase: Supabase;
  entityId: string;
  isGM: boolean;
};

async function getActor(): Promise<ActorContext> {
  const supabase = await createServerSupabaseClient();
  const entityId = await getMyEntityId(supabase);
  if (!entityId) {
    throw new PosShiftError(401, "Not authenticated", "auth_required");
  }
  const isGM = await currentEntityIsGM(supabase);
  return { supabase, entityId, isGM } satisfies ActorContext;
}

async function listHouseRoles(
  supabase: Supabase,
  branchId: string,
  entityId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("house_roles")
    .select("role")
    .eq("house_id", branchId)
    .eq("entity_id", entityId);
  if (error) {
    console.warn("Failed to load house roles", error);
    return [];
  }
  return (data ?? [])
    .map((row) => {
      const value = (row as { role?: string | null }).role;
      return typeof value === "string" ? value.toLowerCase() : null;
    })
    .filter((role): role is string => Boolean(role));
}

function hasManagerAccess(roles: string[]): boolean {
  return roles.some((role) => MANAGER_ROLES.has(role));
}

async function loadSettings(branchId: string): Promise<PosSettings> {
  const snapshot = await getSettingsSnapshot({
    category: "pos",
    businessId: branchId,
    branchId,
  });

  const blind = snapshot["pos.cash.blind_drop_enabled"];
  const poolEnabled = snapshot["pos.cash.overage_pool.enabled"];
  const ratio = snapshot["pos.cash.overage_pool.max_offset_ratio"];
  const defaults = snapshot["pos.cash.float.defaults"];

  return {
    blindDropEnabled: typeof blind?.value === "boolean" ? blind.value : true,
    overagePoolEnabled: typeof poolEnabled?.value === "boolean" ? poolEnabled.value : true,
    overagePoolMaxRatio:
      typeof ratio?.value === "number" && Number.isFinite(ratio.value) ? ratio.value : 0.5,
    floatDefaults:
      defaults && typeof defaults.value === "object" && defaults.value
        ? (defaults.value as Record<string, number>)
        : {},
  } satisfies PosSettings;
}

async function ensureNoOpenShift(
  supabase: Supabase,
  branchId: string,
  cashierId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("pos_shifts")
    .select("id")
    .eq("branch_id", branchId)
    .eq("cashier_entity_id", cashierId)
    .eq("status", "OPEN")
    .maybeSingle<{ id: string }>();

  if (error) {
    throw new PosShiftError(500, "Failed to check existing shifts", "shift_lookup_failed");
  }

  if (data?.id) {
    throw new PosShiftError(409, "An open shift already exists", "shift_exists");
  }
}

async function fetchShift(
  supabase: Supabase,
  shiftId: string,
): Promise<PosShiftRow> {
  const { data, error } = await supabase
    .from("pos_shifts")
    .select("id, house_id, branch_id, cashier_entity_id, opened_at, closed_at, verified_at, opening_float_json, status")
    .eq("id", shiftId)
    .maybeSingle<PosShiftRow>();

  if (error) {
    throw new PosShiftError(500, "Failed to load shift", "shift_load_failed");
  }
  if (!data) {
    throw new PosShiftError(404, "Shift not found", "shift_not_found");
  }
  return data;
}

async function fetchSubmission(
  supabase: Supabase,
  shiftId: string,
): Promise<ShiftSubmissionRow | null> {
  const { data, error } = await supabase
    .from("pos_shift_submissions")
    .select("id, shift_id, submitted_by, submitted_at, denominations_json, total_submitted, notes")
    .eq("shift_id", shiftId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle<ShiftSubmissionRow>();

  if (error) {
    throw new PosShiftError(500, "Failed to load submission", "submission_load_failed");
  }
  return data ?? null;
}

async function fetchOveragePool(
  supabase: Supabase,
  branchId: string,
  cashierId: string,
): Promise<OveragePoolRow | null> {
  const { data, error } = await supabase
    .from("pos_overage_pool")
    .select("id, branch_id, cashier_entity_id, balance_amount")
    .eq("branch_id", branchId)
    .eq("cashier_entity_id", cashierId)
    .maybeSingle<OveragePoolRow>();

  if (error) {
    console.warn("Failed to load overage pool", error);
    return null;
  }

  return data ?? null;
}

async function upsertOveragePool(
  supabase: Supabase,
  branchId: string,
  cashierId: string,
  amount: number,
): Promise<OveragePoolRow> {
  const current = await fetchOveragePool(supabase, branchId, cashierId);
  const balance = Math.max(0, Math.trunc(amount));
  const payload = {
    branch_id: branchId,
    cashier_entity_id: cashierId,
    balance_amount: (current?.balance_amount ?? 0) + balance,
  };

  const { data, error } = await supabase
    .from("pos_overage_pool")
    .upsert(payload, { onConflict: "cashier_entity_id,branch_id" })
    .select("id, branch_id, cashier_entity_id, balance_amount")
    .maybeSingle<OveragePoolRow>();

  if (error) {
    throw new PosShiftError(500, "Failed to update overage pool", "overage_pool_update_failed");
  }

  return data ?? {
    id: current?.id ?? "",
    branch_id: branchId,
    cashier_entity_id: cashierId,
    balance_amount: payload.balance_amount,
  };
}

async function insertLedger(
  supabase: Supabase,
  payload: {
    branchId: string;
    shiftId: string;
    cashierId: string;
    amount: number;
    kind: "SHORT" | "OVER";
    settleMethod: "CASH_NOW" | "PAYROLL" | "OVERAGE_OFFSET" | null;
    notes?: string | null;
  },
  actorId: string,
): Promise<void> {
  const record = {
    branch_id: payload.branchId,
    shift_id: payload.shiftId,
    cashier_entity_id: payload.cashierId,
    amount: Math.max(0, Math.trunc(payload.amount)),
    kind: payload.kind,
    settled_by: payload.settleMethod ? actorId : null,
    settled_at: payload.settleMethod ? new Date().toISOString() : null,
    settle_method: payload.settleMethod,
    notes: payload.notes ?? null,
  };

  const { error } = await supabase.from("pos_variance_ledger").insert(record);
  if (error) {
    throw new PosShiftError(500, "Failed to write variance ledger", "ledger_write_failed");
  }
}

async function resolveCashierUserId(
  supabase: Supabase,
  cashierId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("entities")
    .select("profile")
    .eq("id", cashierId)
    .maybeSingle<{ profile: Json }>();
  if (error) {
    console.warn("Failed to load cashier profile", error);
    return null;
  }
  if (!data?.profile || typeof data.profile !== "object") {
    return null;
  }
  const profile = data.profile as Record<string, unknown>;
  const authId = profile?.auth_user_id;
  return typeof authId === "string" && authId ? authId : null;
}

function normalizeNotes(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function openShift(input: {
  branchId: string;
  cashierEntityId?: string;
  openingFloat?: unknown;
}): Promise<{ shiftId: string; openingTotal: number }> {
  const actor = await getActor();
  const cashierId = input.cashierEntityId ?? actor.entityId;
  const branchId = input.branchId;
  if (!branchId) {
    throw new PosShiftError(400, "branchId is required", "branch_required");
  }

  const roles = await listHouseRoles(actor.supabase, branchId, actor.entityId);
  const isManager = actor.isGM || hasManagerAccess(roles);
  const isSelf = cashierId === actor.entityId;
  if (!isManager && !isSelf) {
    throw new PosShiftError(403, "Forbidden", "open_forbidden");
  }

  await ensureNoOpenShift(actor.supabase, branchId, cashierId);

  const floatMap = normalizeDenominations(input.openingFloat ?? {});
  const openingTotal = calculateDenominationTotal(floatMap);
  const payload = {
    house_id: branchId,
    branch_id: branchId,
    cashier_entity_id: cashierId,
    opening_float_json: denominationMapToJson(floatMap),
  };

  const { data, error } = await actor.supabase
    .from("pos_shifts")
    .insert(payload)
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new PosShiftError(500, "Failed to open shift", "open_failed");
  }

  const shiftId = data.id;

  await emitEvent("audit", "info", {
    action: "pos.shift.open",
    shiftId,
    branchId,
    cashierEntityId: cashierId,
    actorEntityId: actor.entityId,
    openingTotal,
  });

  return { shiftId, openingTotal };
}

export async function submitBlindDrop(input: {
  shiftId: string;
  denominations: unknown;
  notes?: unknown;
}): Promise<{ submissionId: string; totalSubmitted: number }> {
  const actor = await getActor();
  const shift = await fetchShift(actor.supabase, input.shiftId);
  if (shift.cashier_entity_id !== actor.entityId && !actor.isGM) {
    throw new PosShiftError(403, "Forbidden", "submit_forbidden");
  }

  const settings = await loadSettings(shift.branch_id);
  if (!settings.blindDropEnabled) {
    throw new PosShiftError(409, "Blind drops are disabled", "blind_drop_disabled");
  }

  if (shift.status !== "OPEN" && shift.status !== "CLOSED") {
    throw new PosShiftError(409, "Shift is already verified", "shift_not_open");
  }

  const denomMap = normalizeDenominations(input.denominations);
  const totalSubmitted = calculateDenominationTotal(denomMap);
  const notes = normalizeNotes(input.notes);

  const existing = await fetchSubmission(actor.supabase, shift.id);
  let submissionId: string | null = existing?.id ?? null;

  if (existing) {
    const { error: updateError } = await actor.supabase
      .from("pos_shift_submissions")
      .update({
        denominations_json: denominationMapToJson(denomMap),
        total_submitted: totalSubmitted,
        notes,
        submitted_by: actor.entityId,
      })
      .eq("id", existing.id);
    if (updateError) {
      throw new PosShiftError(500, "Failed to update submission", "submission_update_failed");
    }
  } else {
    const { data, error } = await actor.supabase
      .from("pos_shift_submissions")
      .insert({
        shift_id: shift.id,
        submitted_by: actor.entityId,
        denominations_json: denominationMapToJson(denomMap),
        total_submitted: totalSubmitted,
        notes,
      })
      .select("id")
      .single<{ id: string }>();
    if (error) {
      throw new PosShiftError(500, "Failed to record submission", "submission_failed");
    }
    submissionId = data.id;
  }

  const { error: shiftUpdateError } = await actor.supabase
    .from("pos_shifts")
    .update({ status: "CLOSED", closed_at: new Date().toISOString() })
    .eq("id", shift.id);

  if (shiftUpdateError) {
    throw new PosShiftError(500, "Failed to close shift", "close_failed");
  }

  await emitEvent("audit", "info", {
    action: "pos.shift.submit",
    shiftId: shift.id,
    branchId: shift.branch_id,
    cashierEntityId: shift.cashier_entity_id,
    actorEntityId: actor.entityId,
    totalSubmitted,
  });

  if (!submissionId) {
    submissionId = (await fetchSubmission(actor.supabase, shift.id))?.id ?? null;
  }

  if (!submissionId) {
    throw new PosShiftError(500, "Submission not persisted", "submission_missing");
  }

  return { submissionId, totalSubmitted };
}

function validateResolution(
  varianceType: "SHORT" | "OVER" | "NONE",
  resolution: "PAID_NOW" | "PAYROLL_DEDUCT" | "OVERAGE_OFFSET" | "ESCALATED",
): void {
  if (varianceType === "SHORT" && !RESOLUTION_SHORT.has(resolution)) {
    throw new PosShiftError(422, "Invalid resolution for shortage", "resolution_invalid");
  }
  if (varianceType === "OVER" && !RESOLUTION_OVER.has(resolution)) {
    throw new PosShiftError(422, "Invalid resolution for overage", "resolution_invalid");
  }
  if (varianceType === "NONE" && resolution !== "PAID_NOW") {
    throw new PosShiftError(422, "No variance requires PAID_NOW resolution", "resolution_invalid");
  }
}

export async function verifyDrop(input: {
  shiftId: string;
  denominations: unknown;
  resolution: "PAID_NOW" | "PAYROLL_DEDUCT" | "OVERAGE_OFFSET" | "ESCALATED";
  resolutionMeta?: Record<string, unknown> | null;
  notes?: unknown;
}): Promise<{
  verificationId: string;
  varianceAmount: number;
  varianceType: "SHORT" | "OVER" | "NONE";
  overagePoolBalance: number | null;
}> {
  const actor = await getActor();
  const shift = await fetchShift(actor.supabase, input.shiftId);
  const roles = await listHouseRoles(actor.supabase, shift.branch_id, actor.entityId);
  const canVerify = actor.isGM || hasManagerAccess(roles);
  if (!canVerify) {
    throw new PosShiftError(403, "Forbidden", "verify_forbidden");
  }

  if (shift.status !== "CLOSED" && shift.status !== "OPEN") {
    throw new PosShiftError(409, "Shift already verified", "already_verified");
  }

  const submission = await fetchSubmission(actor.supabase, shift.id);
  if (!submission) {
    throw new PosShiftError(409, "Shift has no blind drop submission", "missing_submission");
  }

  const settings = await loadSettings(shift.branch_id);
  const denomMap = normalizeDenominations(input.denominations);
  const totalCounted = calculateDenominationTotal(denomMap);

  const variance = determineVariance(submission.total_submitted ?? 0, totalCounted);
  const notes = normalizeNotes(input.notes);

  validateResolution(variance.varianceType, input.resolution);

  let overagePoolBalance: number | null = null;

  if (variance.varianceType === "SHORT") {
    if (input.resolution === "OVERAGE_OFFSET") {
      if (!settings.overagePoolEnabled) {
        throw new PosShiftError(409, "Overage pool is disabled", "overage_pool_disabled");
      }
      const pool = await fetchOveragePool(actor.supabase, shift.branch_id, shift.cashier_entity_id);
      const balance = pool?.balance_amount ?? 0;
      const { allowed, maxOffset } = canCoverWithOveragePool(
        variance.varianceAmount,
        balance,
        settings.overagePoolMaxRatio,
      );
      if (!allowed) {
        throw new PosShiftError(
          409,
          `Shortage exceeds overage pool limit (max ${maxOffset})`,
          "overage_pool_limit",
        );
      }
      const { data, error } = await actor.supabase.rpc("apply_overage_offset", {
        p_shift_id: shift.id,
        p_amount: variance.varianceAmount,
      });
      if (error) {
        throw new PosShiftError(500, "Failed to apply overage offset", "overage_pool_apply_failed");
      }
      overagePoolBalance = typeof data === "number" ? data : balance - variance.varianceAmount;
    } else {
      const settleMethod =
        input.resolution === "PAYROLL_DEDUCT"
          ? "PAYROLL"
          : input.resolution === "PAID_NOW"
            ? "CASH_NOW"
            : null;
      await insertLedger(
        actor.supabase,
        {
          branchId: shift.branch_id,
          shiftId: shift.id,
          cashierId: shift.cashier_entity_id,
          amount: variance.varianceAmount,
          kind: "SHORT",
          settleMethod,
          notes: notes ?? undefined,
        },
        actor.entityId,
      );
    }
  } else if (variance.varianceType === "OVER") {
    const ledgerNotes = notes ?? "Overage captured during verification";
    if (settings.overagePoolEnabled && variance.varianceAmount > 0) {
      const updated = await upsertOveragePool(
        actor.supabase,
        shift.branch_id,
        shift.cashier_entity_id,
        variance.varianceAmount,
      );
      overagePoolBalance = updated.balance_amount;
    }
    await insertLedger(
      actor.supabase,
      {
        branchId: shift.branch_id,
        shiftId: shift.id,
        cashierId: shift.cashier_entity_id,
        amount: variance.varianceAmount,
        kind: "OVER",
        settleMethod: "CASH_NOW",
        notes: ledgerNotes,
      },
      actor.entityId,
    );
  }

  const { data: verification, error: insertError } = await actor.supabase
    .from("pos_shift_verifications")
    .insert({
      shift_id: shift.id,
      verified_by: actor.entityId,
      denominations_json: denominationMapToJson(denomMap),
      total_counted: totalCounted,
      variance_amount: variance.varianceAmount,
      variance_type: variance.varianceType,
      resolution: input.resolution,
      resolution_meta: input.resolutionMeta ?? {},
      notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError) {
    throw new PosShiftError(500, "Failed to record verification", "verification_failed");
  }

  const { error: updateError } = await actor.supabase
    .from("pos_shifts")
    .update({ status: "VERIFIED", verified_at: new Date().toISOString() })
    .eq("id", shift.id);

  if (updateError) {
    throw new PosShiftError(500, "Failed to finalize shift", "verify_finalize_failed");
  }

  const cashierUserId = await resolveCashierUserId(actor.supabase, shift.cashier_entity_id);

  await emitEvent("audit", "info", {
    action: "pos.shift.verify",
    shiftId: shift.id,
    branchId: shift.branch_id,
    cashierEntityId: shift.cashier_entity_id,
    actorEntityId: actor.entityId,
    varianceType: variance.varianceType,
    varianceAmount: variance.varianceAmount,
    resolution: input.resolution,
  });

  if (cashierUserId) {
    await emitEvent(`tiles:user:${cashierUserId}`, "invalidate", {
      reason: "pos shift verify",
      shiftId: shift.id,
    });
  }
  await emitEvent("reports:cash", "invalidate", { branchId: shift.branch_id });

  return {
    verificationId: verification.id,
    varianceAmount: variance.varianceAmount,
    varianceType: variance.varianceType,
    overagePoolBalance,
  };
}

export type { DenominationMap } from "./shift-utils";
