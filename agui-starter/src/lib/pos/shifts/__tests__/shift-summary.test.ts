import assert from "node:assert";
import test from "node:test";

import { createInMemoryShiftRepository, listShiftSummariesForDate } from "../server";
import type { PosShiftRow } from "../types";

const houseId = "house-1";
const branchId = houseId;

function buildShiftRow(id: string, overrides: Partial<PosShiftRow> = {}): PosShiftRow {
  const now = overrides.opened_at ?? "2024-01-02T03:00:00.000Z";
  return {
    id,
    house_id: houseId,
    branch_id: branchId,
    cashier_entity_id: "cashier-1",
    opened_by_entity_id: "cashier-1",
    closed_by_entity_id: null,
    opened_at: now,
    closed_at: null,
    verified_at: null,
    opening_float_json: {},
    opening_cash_cents: 1000,
    expected_cash_cents: 1000,
    counted_cash_cents: 1200,
    cash_over_short_cents: 0,
    status: "OPEN",
    created_at: now,
    updated_at: now,
    meta: {},
    ...overrides,
  } satisfies PosShiftRow;
}

test("listShiftSummariesForDate aggregates shift totals", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [
      buildShiftRow("shift-1", {
        opening_cash_cents: 1500,
        counted_cash_cents: 1800,
        meta: { closing_notes: "Drawer balanced" },
      }),
    ],
    sales: [
      {
        id: "sale-1",
        house_id: houseId,
        total_cents: 2000,
        change_cents: 500,
        status: "COMPLETED",
        shift_id: "shift-1",
      },
    ],
    tenders: [{ sale_id: "sale-1", house_id: houseId, tender_type: "CASH", amount_cents: 2500 }],
  });

  const summary = await listShiftSummariesForDate({ houseId, userId: "cashier-1", date: "2024-01-02" }, repo);
  assert.equal(summary.shifts.length, 1);
  const shift = summary.shifts[0];
  assert.equal(shift.totalCashTenderCents, 2500);
  assert.equal(shift.expectedCashCents, 3500);
  assert.equal(shift.cashOverShortCents, 1800 - 3500);
  assert.equal(shift.closingNotes, "Drawer balanced");
});

test("listShiftSummariesForDate returns multiple shifts for managers", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [
      buildShiftRow("shift-a", { cashier_entity_id: "cashier-a" }),
      buildShiftRow("shift-b", { cashier_entity_id: "cashier-b", opening_cash_cents: 500, counted_cash_cents: 400 }),
    ],
    sales: [
      { id: "sale-a", house_id: houseId, total_cents: 1000, change_cents: 0, status: "COMPLETED", shift_id: "shift-a" },
      { id: "sale-b", house_id: houseId, total_cents: 800, change_cents: 100, status: "COMPLETED", shift_id: "shift-b" },
    ],
    tenders: [
      { sale_id: "sale-a", house_id: houseId, tender_type: "CASH", amount_cents: 1000 },
      { sale_id: "sale-b", house_id: houseId, tender_type: "CASH", amount_cents: 900 },
    ],
  });

  const summary = await listShiftSummariesForDate(
    { houseId, userId: "manager-1", userRoles: ["manager"], date: "2024-01-02" },
    repo,
  );
  assert.equal(summary.shifts.length, 2);
});

test("cashiers only see their own shifts", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [
      buildShiftRow("shift-1", { cashier_entity_id: "cashier-1" }),
      buildShiftRow("shift-2", { cashier_entity_id: "cashier-2" }),
    ],
  });

  const summary = await listShiftSummariesForDate({ houseId, userId: "cashier-1", date: "2024-01-02" }, repo);
  assert.equal(summary.shifts.length, 1);
  assert.equal(summary.shifts[0]?.cashierId, "cashier-1");
});

test("shifts from other houses are not returned", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [
      buildShiftRow("shift-1"),
      buildShiftRow("shift-3", { id: "shift-other", house_id: "other-house", branch_id: "other-house" }),
    ],
  });

  const summary = await listShiftSummariesForDate({ houseId, userId: "cashier-1", date: "2024-01-02" }, repo);
  assert.equal(summary.shifts.length, 1);
  assert.equal(summary.shifts[0]?.shiftId, "shift-1");
});

test("listShiftSummariesForDate respects the provided time zone", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [
      buildShiftRow("shift-early", { opened_at: "2024-01-02T03:00:00.000Z" }),
      buildShiftRow("shift-late", { id: "shift-late", opened_at: "2024-01-02T10:00:00.000Z" }),
    ],
  });

  const utcSummary = await listShiftSummariesForDate(
    { houseId, userId: "cashier-1", date: "2024-01-02", timeZone: "UTC" },
    repo,
  );
  assert.equal(utcSummary.shifts.length, 2);

  const nySummary = await listShiftSummariesForDate(
    { houseId, userId: "cashier-1", date: "2024-01-02", timeZone: "America/New_York" },
    repo,
  );
  assert.equal(nySummary.shifts.length, 1);
  assert.equal(nySummary.shifts[0]?.shiftId, "shift-late");
});

test("listShiftSummariesForDate falls back when timezone is invalid", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [buildShiftRow("shift-1", { opened_at: "2024-01-02T09:00:00.000Z" })],
  });

  const summary = await listShiftSummariesForDate(
    { houseId, userId: "cashier-1", date: "2024-01-02", timeZone: "Mars/Olympus" },
    repo,
  );

  assert.equal(summary.shifts.length, 1);
  assert.equal(summary.shifts[0]?.shiftId, "shift-1");
});
