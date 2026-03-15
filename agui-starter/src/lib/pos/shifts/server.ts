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

import type {
  CloseShiftInput,
  OpenShiftInput,
  PosDailyShiftSummary,
  PosShiftSummary,
  PosShiftSummaryView,
} from "./types";

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

type SaleForSummary = Pick<PosSaleRow, "id" | "total_cents" | "change_cents" | "status" | "shift_id" | "house_id">;
type TenderForSummary = Pick<PosSaleTenderRow, "sale_id" | "tender_type" | "amount_cents">;

type ShiftRepository = {
  getOpenShiftForUser(params: { houseId: string; branchId: string; userId: string }): Promise<DbPosShiftRow | null>;
  insertShift(payload: PosShiftInsert): Promise<DbPosShiftRow>;
  getShiftById(shiftId: string): Promise<DbPosShiftRow | null>;
  listSalesForShift(
    shiftId: string,
    houseId: string,
  ): Promise<SaleForSummary[]>;
  listSalesForShifts(shiftIds: string[], houseId: string): Promise<SaleForSummary[]>;
  listTendersForSales(
    saleIds: string[],
    houseId: string,
  ): Promise<TenderForSummary[]>;
  listShiftsForDate(params: {
    houseId: string;
    start: string;
    end: string;
    cashierId?: string | null;
  }): Promise<DbPosShiftRow[]>;
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
        .select("id,total_cents,change_cents,status,shift_id,house_id")
        .eq("shift_id", shiftId)
        .eq("house_id", houseId);
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "sales_lookup_failed", 500);
      }
      return (data as SaleForSummary[]) ?? [];
    },
    async listSalesForShifts(shiftIds, houseId) {
      if (shiftIds.length === 0) return [];
      const { data, error } = await supabase
        .from("pos_sales")
        .select("id,total_cents,change_cents,status,shift_id,house_id")
        .in("shift_id", shiftIds)
        .eq("house_id", houseId);
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "sales_lookup_failed", 500);
      }
      return (data as SaleForSummary[]) ?? [];
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
    async listShiftsForDate(params) {
      const query = supabase
        .from("pos_shifts")
        .select("*")
        .eq("house_id", params.houseId)
        .gte("opened_at", params.start)
        .lt("opened_at", params.end)
        .order("opened_at", { ascending: true });

      if (params.cashierId) {
        query.eq("cashier_entity_id", params.cashierId);
      }

      const { data, error } = await query;
      if (error) {
        throw new PosShiftError(error.message, error.code ?? "shift_lookup_failed", 500);
      }
      return (data as DbPosShiftRow[] | null) ?? [];
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
    async listSalesForShifts(shiftIds, houseId) {
      return sales.filter((sale) => shiftIds.includes(sale.shift_id ?? "") && sale.house_id === houseId);
    },
    async listTendersForSales(saleIds, houseId) {
      return tenders.filter((tender) => saleIds.includes(tender.sale_id) && tender.house_id === houseId);
    },
    async listShiftsForDate(params) {
      return shifts.filter((shift) => {
        const matchesHouse = shift.house_id === params.houseId;
        const matchesCashier = params.cashierId ? shift.cashier_entity_id === params.cashierId : true;
        return matchesHouse && matchesCashier && shift.opened_at >= params.start && shift.opened_at < params.end;
      });
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

function groupTendersBySaleId(tenders: TenderForSummary[]): Map<string, TenderForSummary[]> {
  const map = new Map<string, TenderForSummary[]>();
  for (const tender of tenders) {
    const existing = map.get(tender.sale_id) ?? [];
    existing.push(tender);
    map.set(tender.sale_id, existing);
  }
  return map;
}

function computeShiftSummaryFromRecords(
  shift: DbPosShiftRow,
  sales: SaleForSummary[],
  tenderLookup: Map<string, TenderForSummary[]>,
): PosShiftSummary {
  const validSales = sales.filter((sale) => sale.status !== "VOID");
  const totalSalesCents = validSales.reduce((sum, sale) => sum + (sale.total_cents ?? 0), 0);
  const changeCents = validSales.reduce((sum, sale) => sum + (sale.change_cents ?? 0), 0);

  let totalCashTenderCents = 0;
  let totalCreditTenderCents = 0;
  let totalNonCashTenderCents = 0;

  for (const sale of validSales) {
    const saleTenders = tenderLookup.get(sale.id) ?? [];
    for (const tender of saleTenders) {
      if (tender.tender_type === "CASH") {
        totalCashTenderCents += tender.amount_cents ?? 0;
      } else if (tender.tender_type === "CREDIT") {
        totalCreditTenderCents += tender.amount_cents ?? 0;
      } else {
        totalNonCashTenderCents += tender.amount_cents ?? 0;
      }
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

function extractClosingNotes(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>).closing_notes;
  return typeof value === "string" ? value : null;
}

function normalizeShiftSummary(summary: PosShiftSummary): PosShiftSummaryView {
  const cashierId = summary.shift.cashier_entity_id ?? summary.shift.opened_by_entity_id ?? "unknown";
  return {
    shiftId: summary.shift.id,
    cashierId,
    cashierLabel: cashierId,
    openedAt: summary.shift.opened_at,
    closedAt: summary.shift.closed_at,
    status: summary.shift.status,
    openingCashCents: summary.shift.opening_cash_cents ?? 0,
    expectedCashCents: summary.expectedCashCents,
    countedCashCents: summary.shift.counted_cash_cents ?? 0,
    cashOverShortCents: summary.cashOverShortCents,
    totalSalesCents: summary.totalSalesCents,
    totalCashTenderCents: summary.totalCashTenderCents,
    totalNonCashTenderCents: summary.totalNonCashTenderCents,
    totalCreditTenderCents: summary.totalCreditTenderCents,
    closingNotes: extractClosingNotes(summary.shift.meta),
  } satisfies PosShiftSummaryView;
}

function normalizeTimeZone(zone: string | undefined): string {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  if (!zone) return fallback;
  try {
    // Throws on invalid timezones
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return zone;
  } catch (error) {
    console.warn(`Invalid time zone provided to shift summary: ${zone}. Falling back to ${fallback}.`, error);
    return fallback;
  }
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number | null {
  try {
    const zonedString = date.toLocaleString("en-US", { timeZone });
    const zonedDate = new Date(zonedString);
    const offsetMinutes = (zonedDate.getTime() - date.getTime()) / 60000;
    return Number.isFinite(offsetMinutes) ? offsetMinutes : null;
  } catch (error) {
    console.warn(`Unable to resolve time zone offset for ${timeZone}. Using UTC as fallback.`, error);
    return null;
  }
}

function toUtcMidnightForZone(params: { year: number; month: number; day: number; timeZone: string }): string {
  const { year, month, day, timeZone } = params;
  const baseline = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(baseline), timeZone);
  const adjusted = offsetMinutes === null ? baseline : baseline - offsetMinutes * 60_000;
  return new Date(adjusted).toISOString();
}

function resolveDateRange(
  dateInput: string | Date | undefined,
  timeZone: string | undefined,
): { start: string; end: string; label: string; timeZone: string } {
  const zone = normalizeTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const isoDateMatch = typeof dateInput === "string" ? dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  const baseDate = dateInput && !isoDateMatch ? new Date(dateInput) : new Date();
  const safeDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const parts = isoDateMatch
    ? [
        { type: "year", value: isoDateMatch[1]! },
        { type: "month", value: isoDateMatch[2]! },
        { type: "day", value: isoDateMatch[3]! },
      ]
    : formatter.formatToParts(safeDate);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? new Date().getUTCFullYear());
  const monthStr = parts.find((part) => part.type === "month")?.value ?? "01";
  const dayStr = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = Number(monthStr);
  const day = Number(dayStr);
  const start = toUtcMidnightForZone({ year, month, day, timeZone: zone });
  const end = toUtcMidnightForZone({ year, month, day: day + 1, timeZone: zone });
  const label = `${String(year).padStart(4, "0")}-${monthStr}-${dayStr}`;

  return { start, end, label, timeZone: zone };
}

function emptyDailyTotals(): PosDailyShiftSummary["totals"] {
  return {
    openingCashCents: 0,
    cashTenderCents: 0,
    countedCashCents: 0,
    cashOverShortCents: 0,
    salesCents: 0,
  };
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
  const tenderLookup = groupTendersBySaleId(tenders);

  return computeShiftSummaryFromRecords(shift, sales, tenderLookup);
}

export async function listShiftSummariesForDate(
  input: { houseId: string; userId: string; userRoles?: WorkspaceRole[]; date?: string | Date; timeZone?: string },
  client?: RepositoryClient,
): Promise<PosDailyShiftSummary> {
  if (!input.userId) {
    throw new PosShiftError("Missing user context for shift summary", "shift_summary_forbidden", 403);
  }

  const repository = resolveRepository(client);
  const { start, end, label, timeZone } = resolveDateRange(input.date, input.timeZone);
  const isManager = userHasManagerRole(input.userRoles);

  const shifts = await repository.listShiftsForDate({
    houseId: input.houseId,
    start,
    end,
    cashierId: isManager ? null : input.userId,
  });

  const scopedShifts = (isManager ? shifts : shifts.filter((shift) => shift.cashier_entity_id === input.userId)).map((shift) =>
    assertShiftHouse(shift, input.houseId),
  );

  if (scopedShifts.length === 0) {
    return { date: label, timeZone, shifts: [], totals: emptyDailyTotals() } satisfies PosDailyShiftSummary;
  }

  const shiftIds = scopedShifts.map((shift) => shift.id);
  const sales = await repository.listSalesForShifts(shiftIds, input.houseId);
  const validSales = sales.filter((sale) => sale.status !== "VOID");
  const tenders = await repository.listTendersForSales(
    validSales.map((sale) => sale.id),
    input.houseId,
  );
  const tenderLookup = groupTendersBySaleId(tenders);

  const normalizedSummaries = scopedShifts.map((shift) => {
    const shiftSales = sales.filter((sale) => sale.shift_id === shift.id);
    const summary = computeShiftSummaryFromRecords(shift, shiftSales, tenderLookup);
    return normalizeShiftSummary(summary);
  });

  const totals = normalizedSummaries.reduce((acc, item) => {
    acc.openingCashCents += item.openingCashCents;
    acc.cashTenderCents += item.totalCashTenderCents;
    acc.countedCashCents += item.countedCashCents;
    acc.cashOverShortCents += item.cashOverShortCents;
    acc.salesCents += item.totalSalesCents;
    return acc;
  }, emptyDailyTotals());

  return { date: label, timeZone, shifts: normalizedSummaries, totals } satisfies PosDailyShiftSummary;
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
