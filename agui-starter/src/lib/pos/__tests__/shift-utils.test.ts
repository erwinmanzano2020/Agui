import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateDenominationTotal,
  canCoverWithOveragePool,
  determineVariance,
  normalizeDenominations,
} from "@/lib/pos/shift-utils";

describe("pos shift utils", () => {
  it("normalizes denomination payloads", () => {
    const map = normalizeDenominations({
      100: 2,
      "50": 3,
      "junk": "ignored",
    });
    assert.equal(map.size, 2);
    assert.equal(map.get(100), 2);
    assert.equal(map.get(50), 3);
  });

  it("computes denomination totals", () => {
    const map = normalizeDenominations({ 1000: 1, 500: 2, 25: 4 });
    const total = calculateDenominationTotal(map);
    assert.equal(total, 1000 * 1 + 500 * 2 + 25 * 4);
  });

  it("calculates variance types", () => {
    assert.deepEqual(determineVariance(1000, 1000), {
      varianceType: "NONE",
      varianceAmount: 0,
      difference: 0,
    });
    assert.deepEqual(determineVariance(1000, 1200), {
      varianceType: "OVER",
      varianceAmount: 200,
      difference: 200,
    });
    assert.deepEqual(determineVariance(1200, 1000), {
      varianceType: "SHORT",
      varianceAmount: 200,
      difference: -200,
    });
  });

  it("enforces overage pool ratios", () => {
    const { allowed, maxOffset } = canCoverWithOveragePool(200, 1000, 0.5);
    assert.equal(maxOffset, 500);
    assert.equal(allowed, true);

    const denied = canCoverWithOveragePool(600, 1000, 0.5);
    assert.equal(denied.allowed, false);
    assert.equal(denied.maxOffset, 500);
  });
});
