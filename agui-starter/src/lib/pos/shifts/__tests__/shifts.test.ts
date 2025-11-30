import assert from "node:assert";
import test from "node:test";

import { closeShift, computeShiftTotals, createInMemoryShiftRepository, openShift, PosShiftError } from "../server";

const houseId = "house-1";
const branchId = houseId;
const userId = "cashier-1";

function buildShiftRow(id: string) {
  const now = new Date().toISOString();
  return {
    id,
    house_id: houseId,
    branch_id: branchId,
    cashier_entity_id: userId,
    opened_by_entity_id: userId,
    closed_by_entity_id: null,
    opened_at: now,
    closed_at: null,
    verified_at: null,
    opening_float_json: {},
    opening_cash_cents: 1000,
    expected_cash_cents: 1000,
    counted_cash_cents: 0,
    cash_over_short_cents: 0,
    status: "OPEN",
    created_at: now,
    updated_at: now,
    meta: {},
  } as const;
}

test("openShift creates a shift and prevents duplicates", async () => {
  const repo = createInMemoryShiftRepository();
  const opened = await openShift({ houseId, branchId, userId, openingCashCents: 1500 }, repo);
  assert.equal(opened.opening_cash_cents, 1500);
  assert.equal(opened.expected_cash_cents, 1500);

  await assert.rejects(
    () => openShift({ houseId, branchId, userId, openingCashCents: 500 }, repo),
    (error: unknown) => error instanceof PosShiftError && error.code === "shift_exists",
  );
});

test("computeShiftTotals aggregates tenders and change", async () => {
  const repo = createInMemoryShiftRepository({
    shifts: [buildShiftRow("shift-1")],
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
    tenders: [
      { sale_id: "sale-1", house_id: houseId, tender_type: "CASH", amount_cents: 2500 },
      { sale_id: "sale-1", house_id: houseId, tender_type: "EWALLET", amount_cents: 1000 },
    ],
  });

  const summary = await computeShiftTotals({ shiftId: "shift-1", houseId }, repo);
  assert.equal(summary.totalSalesCents, 2000);
  assert.equal(summary.totalCashTenderCents, 2500);
  assert.equal(summary.totalNonCashTenderCents, 1000);
  assert.equal(summary.expectedCashCents, 3000);
});

test("closeShift stores counted cash and variance", async () => {
  const repo = createInMemoryShiftRepository({ shifts: [buildShiftRow("shift-2")] });
  const summary = await closeShift({ shiftId: "shift-2", houseId, userId, countedCashCents: 2800 }, repo);

  assert.equal(summary.shift.status, "CLOSED");
  assert.equal(summary.shift.counted_cash_cents, 2800);
  assert.equal(summary.expectedCashCents, 1000);
  assert.equal(summary.cashOverShortCents, 1800);
});
