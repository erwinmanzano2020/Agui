import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateManifest,
  computeSplit,
  computeEqualSplit,
  validateTenderLines,
} from "@/lib/pos/tenders";

describe("pos tenders", () => {
  it("validates and normalizes multi-tender payloads", () => {
    const result = validateTenderLines({
      amountDue: 10_000,
      allowChange: true,
      loyaltyBalance: 200,
      tenders: [
        { type: "CASH", amount: 7_000 },
        { type: "GCASH", amount: 2_000, metadata: { reference: "GC-REF-01" } },
        {
          type: "LOYALTY",
          amount: 1_000,
          metadata: { pointsRedeemed: 10, conversionRate: 100, remainingPoints: 150 },
        },
      ],
    });

    assert.equal(result.totalTendered, 10_000);
    assert.equal(result.changeDue, 0);
    assert.equal(result.balanceDue, 0);
    assert.equal(result.normalizedTenders.length, 3);
    assert.ok(result.breakdown.cash);
    assert.ok(result.breakdown.gcash);
    assert.ok(result.breakdown.loyalty);
    assert.deepEqual(result.loyalty, {
      pointsRedeemed: 10,
      conversionRate: 100,
      remainingPoints: 190,
    });

    const manifest = aggregateManifest(result.normalizedTenders);
    assert.equal(manifest.cash.total, 7_000);
    assert.equal(manifest.ewallets.GCash.total, 2_000);
    assert.equal(manifest.loyalty.points, 10);
    assert.equal(manifest.nonCashTotal, 3_000);
  });

  it("rejects over-tendering via non-cash payments", () => {
    assert.throws(
      () =>
        validateTenderLines({
          amountDue: 5_000,
          tenders: [{ type: "GCASH", amount: 6_000, metadata: { reference: "OVR" } }],
        }),
      /Non-cash tenders cannot exceed the amount due/,
    );
  });

  it("prevents loyalty redemption above the customer balance", () => {
    assert.throws(
      () =>
        validateTenderLines({
          amountDue: 1_000,
          loyaltyBalance: 5,
          tenders: [
            { type: "CASH", amount: 500 },
            { type: "LOYALTY", amount: 600, metadata: { pointsRedeemed: 6, conversionRate: 100 } },
          ],
        }),
      /LOYALTY tender exceeds available points/,
    );
  });

  it("computes equal and weighted splits", () => {
    const equal = computeEqualSplit(9_001, 3);
    assert.deepEqual(equal, [3_001, 3_000, 3_000]);

    const weighted = computeSplit({
      amountDue: 10_000,
      participants: [
        { id: "alice" },
        { id: "bob" },
        { id: "carol" },
      ],
      shares: [
        { participantId: "alice", weight: 1 },
        { participantId: "bob", weight: 2 },
        { participantId: "carol", weight: 1 },
      ],
    });

    assert.equal(weighted.amountDue, 10_000);
    assert.deepEqual(weighted.shares, [
      { participantId: "alice", amount: 2_500 },
      { participantId: "bob", amount: 5_000 },
      { participantId: "carol", amount: 2_500 },
    ]);

    const explicit = computeSplit({
      amountDue: 9_000,
      participants: [
        { id: "p1" },
        { id: "p2" },
        { id: "p3" },
      ],
      shares: [
        { participantId: "p1", amount: 2_000 },
        { participantId: "p2", amount: 3_000 },
        { participantId: "p3", amount: 4_000 },
      ],
    });

    assert.deepEqual(explicit.shares, [
      { participantId: "p1", amount: 2_000 },
      { participantId: "p2", amount: 3_000 },
      { participantId: "p3", amount: 4_000 },
    ]);
  });
});
