import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Database,
  PosSaleRow,
  PosSaleTenderRow,
  PosShiftInsert,
  PosShiftRow as DbPosShiftRow,
} from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import type { WorkspaceRole } from "@/lib/workspaces/roles";

import type { CloseShiftInput, OpenShiftInput, PosShiftSummary } from "./types";

export class PosShiftError extends Error {
  code: string;
  status: number;

  constructor(message: string, code = "SHIFT_ERROR", status = 400) {
    super(message);
    this.name = "PosShiftError";
    this.code = code;
    this.status = status;
  }
}

type ShiftRepository = {
  getOpenShiftForUser(params: { houseId: string; branchId: string; userId: string }): Promise<DbPosShiftRow | null>;
  insertShift(payload: PosShiftInsert): Promise<DbPosShiftRow>;
  getShiftById(shiftId: string): Promise<DbPosShiftRow | null>;
  listSalesForShift(
    shiftId: string,
    houseId: string,
  ): Promise<Array<Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status">>>;
  listTendersForSales(
    saleIds: string[],
    houseId: string,
  ): Promise<Array<Pick<PosSaleTenderRow, "sale_id" | "tender_type" | "amount_cents">>>;
  updateShift(shiftId: string, updates: Partial<DbPosShiftRow>): Promise<DbPosShiftRow>;
};

type RepositoryClient = SupabaseClient<Database> | ShiftRepository | null | undefined;

function normalizeBranchId(branchId: string | null | undefined, houseId: string) {
  return branchId ?? houseId;
}

function createSupabaseRepository(client?: SupabaseClient<Database> | null): ShiftRepository {
  const supabase = client ?? createServiceSupabaseClient<Database>();

  return {
    async getOpenShiftForUser(params) {
      const { data, error } = await supabase
        .from("pos_shifts")
        .select("*")
        .eq("house_id", params.houseId)
        .eq("branch_id", params.branchId)
        .eq("opened_by_entity_id", params.userId)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle<DbPosShiftRow>();
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "shift_lookup_failed", 500);
      }
      return data ?? null;
    },
    async insertShift(payload) {
      const { data, error } = await supabase.from("pos_shifts").insert(payload).select("*").maybeSingle<DbPosShiftRow>();
      if (error) {
        const code = (error as { code?: string })?.code;
        throw new PosShiftError(error.message, code ?? "shift_insert_failed", 500);
      }
      if (!data) {
        throw new PosShiftError("Failed to create shift", "shift_insert_failed", 500);
      }
      return data as DbPosShiftRow;
    },
    async getShiftById(shiftId) {
      const { data, error } = await supabase.from("pos_shifts").select("*").eq("id", shiftId).maybeSingle<DbPosShiftRow>();
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "shift_lookup_failed", 500);
      }
      return (data as DbPosShiftRow | null) ?? null;
    },
    async listSalesForShift(shiftId, houseId) {
      const { data, error } = await supabase
        .from("pos_sales")
        .select("id,total_cents,change_cents,status")
        .eq("shift_id", shiftId)
        .eq("house_id", houseId);
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "sales_lookup_failed", 500);
      }
      return (data as Array<Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status">>) ?? [];
    },
    async listTendersForSales(saleIds, houseId) {
      if (saleIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pos_sale_tenders")
        .select("sale_id,tender_type,amount_cents,house_id")
        .in("sale_id", saleIds)
        .eq("house_id", houseId);
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "tenders_lookup_failed", 500);
      }
      return (
        (data as Array<PosSaleTenderRow & { house_id: string }> | null)?.map((row) => ({
          sale_id: row.sale_id,
          tender_type: row.tender_type,
          amount_cents: row.amount_cents,
        })) ?? []
      );
    },
    async updateShift(shiftId, updates) {
      const { data, error } = await supabase
        .from("pos_shifts")
        .update(updates)
        .eq("id", shiftId)
        .select("*")
        .maybeSingle<DbPosShiftRow>();
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "shift_update_failed", 500);
      }
      if (!data) {
        throw new PosShiftError("Shift not found", "shift_not_found", 404);
      }
      return data as DbPosShiftRow;
    },
  } satisfies ShiftRepository;
}

export function createInMemoryShiftRepository(initial?: Partial<{
  shifts: DbPosShiftRow[];
  sales: Array<Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status" | "shift_id" | "house_id">>;
  tenders: Array<Pick<PosSaleTenderRow, "sale_id" | "tender_type" | "amount_cents" | "house_id">>;
}>): ShiftRepository & {
  shifts: DbPosShiftRow[];
  sales: Array<Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status" | "shift_id" | "house_id">>;
  tenders: Array<Pick<PosSaleTenderRow, "sale_id" | "tender_type" | "amount_cents" | "house_id">>;
} {
  const shifts = [...(initial?.shifts ?? [])];
  const sales = [...(initial?.sales ?? [])];
  const tenders = [...(initial?.tenders ?? [])];

  return {
    shifts,
    sales,
    tenders,
    async getOpenShiftForUser({ houseId, branchId, userId }) {
      const branch = normalizeBranchId(branchId, houseId);
      const found = shifts
        .filter((shift) => shift.house_id === houseId && shift.branch_id === branch && shift.opened_by_entity_id === userId)
        .filter((shift) => shift.status === "OPEN")
        .sort((a, b) => b.opened_at.localeCompare(a.opened_at))[0];
      return found ?? null;
    },
    async insertShift(payload) {
      const now = payload.opened_at ?? new Date().toISOString();
      const row: DbPosShiftRow = {
        id: payload.id ?? `shift-${shifts.length + 1}`,
        house_id: payload.house_id,
        branch_id: payload.branch_id,
        cashier_entity_id: payload.cashier_entity_id ?? payload.opened_by_entity_id ?? "cashier-1",
        opened_by_entity_id: payload.opened_by_entity_id ?? payload.cashier_entity_id ?? "cashier-1",
        closed_by_entity_id: payload.closed_by_entity_id ?? null,
        opened_at: now,
        closed_at: payload.closed_at ?? null,
        verified_at: payload.verified_at ?? null,
        opening_float_json: payload.opening_float_json ?? {},
        opening_cash_cents: payload.opening_cash_cents ?? 0,
        expected_cash_cents: payload.expected_cash_cents ?? payload.opening_cash_cents ?? 0,
        counted_cash_cents: payload.counted_cash_cents ?? 0,
        cash_over_short_cents: payload.cash_over_short_cents ?? 0,
        status: payload.status ?? "OPEN",
        created_at: payload.created_at ?? now,
        updated_at: payload.updated_at ?? now,
        meta: payload.meta ?? {},
      };
      shifts.push(row);
      return row;
    },
    async getShiftById(shiftId) {
      return shifts.find((shift) => shift.id === shiftId) ?? null;
    },
    async listSalesForShift(shiftId, houseId) {
      return sales.filter((sale) => sale.shift_id === shiftId && sale.house_id === houseId);
    },
    async listTendersForSales(saleIds, houseId) {
      return tenders.filter((tender) => saleIds.includes(tender.sale_id) && tender.house_id === houseId);
    },
    async updateShift(shiftId, updates) {
      const index = shifts.findIndex((shift) => shift.id === shiftId);
      if (index === -1) {
        throw new PosShiftError("Shift not found", "shift_not_found", 404);
      }
      const next: DbPosShiftRow = { ...shifts[index]!, ...updates, id: shiftId } as DbPosShiftRow;
      shifts[index] = next;
      return next;
    },
  } satisfies ShiftRepository & {
    shifts: DbPosShiftRow[];
    sales: Array<Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status" | "shift_id" | "house_id">>;
    tenders: Array<Pick<PosSaleTenderRow, "sale_id" | "tender_type" | "amount_cents" | "house_id">>;
  };
}

function resolveRepository(client?: RepositoryClient): ShiftRepository {
  if (client && typeof (client as ShiftRepository).getOpenShiftForUser === "function") {
    return client as ShiftRepository;
  }
  const supabaseClient = client as SupabaseClient<Database> | null;
  return createSupabaseRepository(supabaseClient);
}

function ensureNonNegativeInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new PosShiftError(`${label} must be a non-negative integer`, "invalid_amount");
  }
  const rounded = Math.trunc(value);
  if (!Number.isSafeInteger(rounded)) {
    throw new PosShiftError(`${label} exceeds allowed range`, "invalid_amount");
  }
  return rounded;
}

function assertShiftHouse(shift: DbPosShiftRow | null, houseId: string): DbPosShiftRow {
  if (!shift) {
    throw new PosShiftError("Shift not found", "shift_not_found", 404);
  }
  if (shift.house_id !== houseId) {
    throw new PosShiftError("Shift not found or not accessible", "shift_forbidden", 403);
  }
  return shift;
}

function userHasManagerRole(roles?: WorkspaceRole[]): boolean {
  return (roles ?? []).some((role) => role === "owner" || role === "manager");
}

export async function getOpenShiftForUser(
  input: { houseId: string; branchId?: string | null; userId: string },
  client?: RepositoryClient,
): Promise<DbPosShiftRow | null> {
  const repository = resolveRepository(client);
  const branchId = normalizeBranchId(input.branchId, input.houseId);
  return repository.getOpenShiftForUser({ ...input, branchId });
}

export async function openShift(input: OpenShiftInput, client?: RepositoryClient): Promise<DbPosShiftRow> {
  const repository = resolveRepository(client);
  const branchId = normalizeBranchId(input.branchId, input.houseId);
  const amount = ensureNonNegativeInteger(input.openingCashCents, "Opening cash");
  const existing = await repository.getOpenShiftForUser({
    houseId: input.houseId,
    branchId,
    userId: input.userId,
  });

  if (existing) {
    throw new PosShiftError("An open shift already exists", "shift_exists", 409);
  }

  const payload: PosShiftInsert = {
    house_id: input.houseId,
    branch_id: branchId,
    opened_by_entity_id: input.userId,
    cashier_entity_id: input.userId,
    opening_cash_cents: amount,
    expected_cash_cents: amount,
    status: "OPEN",
    meta: {},
  };

  return repository.insertShift(payload);
}

export async function computeShiftTotals(
  input: { shiftId: string; houseId: string },
  client?: RepositoryClient,
  options?: { shift?: DbPosShiftRow },
): Promise<PosShiftSummary> {
  const repository = resolveRepository(client);
  const shift = assertShiftHouse(options?.shift ?? (await repository.getShiftById(input.shiftId)), input.houseId);
  const sales = await repository.listSalesForShift(input.shiftId, input.houseId);
  const validSales = sales.filter((sale) => sale.status !== "VOID");
  const saleIds = validSales.map((sale) => sale.id);
  const tenders = await repository.listTendersForSales(saleIds, input.houseId);

  const totalSalesCents = validSales.reduce((sum, sale) => sum + (sale.total_cents ?? 0), 0);
  const changeCents = validSales.reduce((sum, sale) => sum + (sale.change_cents ?? 0), 0);

  let totalCashTenderCents = 0;
  let totalCreditTenderCents = 0;
  let totalNonCashTenderCents = 0;
  for (const tender of tenders) {
    if (tender.tender_type === "CASH") {
      totalCashTenderCents += tender.amount_cents ?? 0;
    } else if (tender.tender_type === "CREDIT") {
      totalCreditTenderCents += tender.amount_cents ?? 0;
    } else {
      totalNonCashTenderCents += tender.amount_cents ?? 0;
    }
  }

  const expectedCashCents = (shift.opening_cash_cents ?? 0) + totalCashTenderCents - changeCents;
  const counted = shift.counted_cash_cents ?? 0;
  const cashOverShortCents = counted - expectedCashCents;

  return {
    shift,
    totalSalesCents,
    totalCashTenderCents,
    totalNonCashTenderCents,
    totalCreditTenderCents,
    expectedCashCents,
    cashOverShortCents,
  } satisfies PosShiftSummary;
}

export async function closeShift(input: CloseShiftInput, client?: RepositoryClient): Promise<PosShiftSummary> {
  const repository = resolveRepository(client);
  const countedCashCents = ensureNonNegativeInteger(input.countedCashCents, "Counted cash");
  const shift = assertShiftHouse(await repository.getShiftById(input.shiftId), input.houseId);

  if (shift.status !== "OPEN") {
    throw new PosShiftError("Shift is already closed", "shift_not_open", 409);
  }

  const isOwner = shift.opened_by_entity_id === input.userId;
  const isManager = userHasManagerRole(input.userRoles);
  if (!isOwner && !isManager) {
    throw new PosShiftError(
      "You can’t close another cashier’s shift. Ask a manager.",
      "shift_close_forbidden",
      403,
    );
  }

  const summary = await computeShiftTotals({ shiftId: input.shiftId, houseId: input.houseId }, repository, { shift });
  const expectedCashCents = summary.expectedCashCents;
  const cashOverShortCents = countedCashCents - expectedCashCents;
  const currentMeta =
    shift.meta && typeof shift.meta === "object" && !Array.isArray(shift.meta) ? (shift.meta as Record<string, unknown>) : {};
  const closedShift = await repository.updateShift(input.shiftId, {
    status: "CLOSED",
    closed_at: new Date().toISOString(),
    closed_by_entity_id: input.userId,
    counted_cash_cents: countedCashCents,
    expected_cash_cents: expectedCashCents,
    cash_over_short_cents: cashOverShortCents,
    meta: { ...currentMeta, closing_notes: input.closingNotes ?? null },
  });

  return {
    ...summary,
    shift: closedShift,
    expectedCashCents,
    cashOverShortCents,
  } satisfies PosShiftSummary;
}
