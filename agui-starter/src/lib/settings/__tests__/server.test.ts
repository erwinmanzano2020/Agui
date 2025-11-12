import { describe, it } from "node:test";
import assert from "node:assert";

import { __testing } from "../server";

const { resolveValueForKey, coerceValueForKey } = __testing;

describe("coerceValueForKey", () => {
  it("accepts boolean values", () => {
    const result = coerceValueForKey("receipt.show_total_savings", true);
    assert.strictEqual(result, true);
  });

  it("throws on invalid types", () => {
    assert.throws(() => coerceValueForKey("receipt.show_total_savings", "yes"));
  });
});

describe("resolveValueForKey", () => {
  it("prefers branch overrides", () => {
    const result = resolveValueForKey(
      "receipt.footer_text",
      [
        {
          scope: "BRANCH" as const,
          business_id: "biz",
          branch_id: "branch",
          value: "Branch Footer",
        },
        {
          scope: "BUSINESS" as const,
          business_id: "biz",
          branch_id: null,
          value: "Business Footer",
        },
      ],
      { businessId: "biz", branchId: "branch" },
    );
    assert.strictEqual(result.value, "Branch Footer");
    assert.strictEqual(result.source, "BRANCH");
  });

  it("falls back to GM default", () => {
    const result = resolveValueForKey("labels.discount.manual", [], { businessId: null, branchId: null });
    assert.strictEqual(result.value, "Manual");
    assert.strictEqual(result.source, "GM");
  });
});
