import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { evaluateHrAccess, requireHrAccessWithBranch } from "../access";
import * as policyServer from "@/lib/policy/server";

afterEach(() => {
  mock.restoreAll();
});

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

describe("requireHrAccessWithBranch", () => {
  it("fails closed when house_roles lookup is unavailable in runtime", async () => {
    mock.method(policyServer, "getCurrentEntityAndPolicies", async () => ({
      entityId: "entity-1",
      policyKeys: ["tiles.hr.read"],
    }) as never);

    const supabase = {
      from() {
        let eqCalls = 0;
        return {
          select() {
            return this;
          },
          eq() {
            eqCalls += 1;
            if (eqCalls >= 2) {
              return Promise.resolve({
                data: null,
                error: { code: "42P01", message: "relation house_roles does not exist" },
              });
            }
            return this;
          },
        };
      },
    };

    const decision = await requireHrAccessWithBranch(supabase as never, { houseId: "house-1" });
    assert.equal(decision.allowed, false);
    assert.equal(decision.allowedByPolicy, true);
    assert.equal(decision.hasWorkspaceAccess, false);
    assert.equal(decision.isBranchLimited, false);
    assert.deepEqual(decision.allowedBranchIds, []);
  });

  it("denies zero-scope branch access for non-role actors", async () => {
    mock.method(policyServer, "getCurrentEntityAndPolicies", async () => ({
      entityId: "entity-1",
      policyKeys: ["tiles.hr.read"],
    }) as never);

    const supabase = {
      from() {
        let eqCalls = 0;
        return {
          select() {
            return this;
          },
          eq() {
            eqCalls += 1;
            if (eqCalls >= 2) {
              return Promise.resolve({ data: [{ role: "house_staff" }], error: null });
            }
            return this;
          },
        };
      },
    };

    const decision = await requireHrAccessWithBranch(supabase as never, { houseId: "house-1" });
    assert.equal(decision.allowed, false);
    assert.equal(decision.isBranchLimited, true);
    assert.deepEqual(decision.allowedBranchIds, []);
  });
});
