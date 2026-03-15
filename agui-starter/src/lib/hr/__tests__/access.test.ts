import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { evaluateHrAccess } from "../access";

describe("evaluateHrAccess", () => {
  it("allows workspace owners to open HR", () => {
    const decision = evaluateHrAccess({
      roles: ["house_owner"],
      policyKeys: [],
      entityId: "entity-1",
    });

    assert.equal(decision.allowed, true);
    assert.equal(decision.allowedByRole, true);
    assert.equal(decision.hasWorkspaceAccess, true);
  });

  it("denies staff even when they are workspace members", () => {
    const decision = evaluateHrAccess({
      roles: ["house_staff"],
      policyKeys: [],
      entityId: "entity-2",
    });

    assert.equal(decision.hasWorkspaceAccess, true);
    assert.equal(decision.allowedByRole, false);
    assert.equal(decision.allowed, false);
  });

  it("requires workspace membership even when HR policies exist", () => {
    const decision = evaluateHrAccess({
      roles: [],
      policyKeys: ["tiles.hr.read"],
      entityId: "entity-3",
    });

    assert.equal(decision.allowedByPolicy, true);
    assert.equal(decision.hasWorkspaceAccess, false);
    assert.equal(decision.allowed, false);
  });
});
