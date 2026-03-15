import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluatePosAccess } from "./access";

describe("evaluatePosAccess", () => {
  it("allows POS for house owners even without explicit policies", () => {
    const decision = evaluatePosAccess({
      roles: ["house_owner"],
      policyKeys: [],
      entityId: "entity-123",
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.allowedByRole, true);
    assert.equal(decision.allowedByPolicy, false);
  });

  it("allows POS when policy grants access", () => {
    const decision = evaluatePosAccess({
      roles: [],
      policyKeys: ["tiles.pos.read"],
      entityId: "entity-456",
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.allowedByRole, false);
    assert.equal(decision.allowedByPolicy, true);
  });

  it("denies POS when roles and policies are missing", () => {
    const decision = evaluatePosAccess({
      roles: ["guest"],
      policyKeys: [],
      entityId: "entity-789",
    });

    assert.equal(decision.allowed, false);
    assert.equal(decision.allowedByRole, false);
    assert.equal(decision.allowedByPolicy, false);
  });
});
