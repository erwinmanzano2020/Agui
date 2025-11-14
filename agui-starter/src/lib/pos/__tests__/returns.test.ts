import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeReturn, computeVoidSummary } from "@/lib/pos/returns";

import type { NormalizedTenderLine } from "@/lib/pos/tenders";

describe("pos returns", () => {
  it("computes proportional tender reversals", () => {
    const tenders: NormalizedTenderLine[] = [
      { type: "CASH", amount: 5_000, metadata: null },
      { type: "GCASH", amount: 3_000, metadata: { reference: "GC-123" } },
      {
        type: "LOYALTY",
        amount: 2_000,
        metadata: { pointsRedeemed: 20, conversionRate: 100, remainingPoints: 80 },
      },
    ];

    const result = computeReturn({
      sale: {
        saleId: "sale-1",
        lines: [
          { id: "line-1", quantity: 2, unitPrice: 3_000, lineTotal: 6_000 },
          { id: "line-2", quantity: 1, unitPrice: 4_000, lineTotal: 4_000 },
        ],
        tenders,
      },
      selections: [
        { lineId: "line-1", quantity: 1, reason: "Damaged" },
        { lineId: "line-2", quantity: 1 },
      ],
      exchangeAmount: 2_000,
      loyaltyConversionRate: 100,
    });

    assert.equal(result.totalReturnValue, 7_000);
    assert.equal(result.exchangeValue, 2_000);
    assert.equal(result.refundDue, 5_000);
    assert.equal(result.tenderReversals.length, 3);

    const cash = result.tenderReversals.find((tender) => tender.type === "CASH");
    assert.equal(cash?.amount, 2_500);
    assert.equal(cash?.direction, "CREDIT");

    const gcash = result.tenderReversals.find((tender) => tender.type === "GCASH");
    assert.equal(gcash?.amount, 1_500);

    const loyalty = result.tenderReversals.find((tender) => tender.type === "LOYALTY");
    assert.equal(loyalty?.amount, 1_000);
    assert.ok(result.loyalty);
    assert.equal(result.loyalty?.pointsToRestore, 10);
    assert.equal(result.loyalty?.value, 1_000);
  });

  it("summarizes void audit payloads", () => {
    const summary = computeVoidSummary({
      saleId: "sale-void-1",
      reason: "Wrong ticket",
      approvedBy: "supervisor-9",
      voidLines: [
        { lineId: "line-1", quantity: 1 },
        { lineId: "line-3", quantity: 2 },
      ],
    });

    assert.equal(summary.saleId, "sale-void-1");
    assert.equal(summary.audit.linesVoided, 2);
    assert.equal(summary.audit.hasInventoryImpact, true);
  });
});
