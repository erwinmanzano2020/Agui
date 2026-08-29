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
  it("distinguishes read and write policy capability while preserving authority roles", () => {
    for (const role of ["house_owner", "house_manager"]) {
      assert.equal(evaluateHrAccess({ roles: [role], policyKeys: [], entityId: "entity", requiredLevel: "read" }).allowed, true);
      assert.equal(evaluateHrAccess({ roles: [role], policyKeys: [], entityId: "entity", requiredLevel: "write" }).allowed, true);
    }
    assert.equal(evaluateHrAccess({ roles: ["house_staff"], policyKeys: ["tiles.hr.read"], entityId: "entity", requiredLevel: "read" }).allowed, true);
    assert.equal(evaluateHrAccess({ roles: ["house_staff"], policyKeys: ["tiles.hr.read"], entityId: "entity", requiredLevel: "write" }).allowed, false);
    assert.equal(evaluateHrAccess({ roles: ["house_staff"], policyKeys: ["domain.hr.all"], entityId: "entity", requiredLevel: "write" }).allowed, true);
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

  it("binds HR and payroll write capabilities to the requested house", async () => {
    const houseA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const houseB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const branchA = "11111111-1111-4111-8111-111111111111";
    mock.method(policyServer, "getCurrentEntityAndPolicies", async () => ({
      entityId: "entity-staff",
      policyKeys: ["domain.hr.all", "domain.payroll.all", `hr.branch.${branchA}`],
    }) as never);
    mock.method(policyServer, "listPolicyKeysForEntityAtHouse", async (_client: unknown, _entityId: string, houseId: string) =>
      houseId === houseA ? ["domain.hr.all", "domain.payroll.all", `hr.branch.${branchA}`] : [],
    );
    const supabase = {
      from() {
        return {
          select() { return this; },
          eq() { return this; },
          then(resolve: (value: unknown) => void) { resolve({ data: [{ role: "house_staff" }], error: null }); },
        };
      },
    };

    for (const capability of ["hr", "payroll"] as const) {
      const allowed = await requireHrAccessWithBranch(supabase as never, {
        houseId: houseA, branchId: branchA, requiredLevel: "write", requiredCapability: capability,
      });
      assert.equal(allowed.allowed, true);
      const wrongHouse = await requireHrAccessWithBranch(supabase as never, {
        houseId: houseB, branchId: branchA, requiredLevel: "write", requiredCapability: capability,
      });
      assert.equal(wrongHouse.allowed, false);
    }

    const wrongBranch = await requireHrAccessWithBranch(supabase as never, {
      houseId: houseA,
      branchId: "22222222-2222-4222-8222-222222222222",
      requiredLevel: "write",
      requiredCapability: "payroll",
    });
    assert.equal(wrongBranch.allowed, false);
  });

  it("keeps requested-house owner and manager authority policy-independent", async () => {
    mock.method(policyServer, "getCurrentEntityAndPolicies", async () => ({ entityId: "entity", policyKeys: [] }) as never);
    for (const role of ["house_owner", "house_manager"]) {
      const supabase = {
        from() {
          return {
            select() { return this; }, eq() { return this; },
            then(resolve: (value: unknown) => void) { resolve({ data: [{ role }], error: null }); },
          };
        },
      };
      const decision = await requireHrAccessWithBranch(supabase as never, {
        houseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        requiredLevel: "write",
        requiredCapability: "payroll",
      });
      assert.equal(decision.allowed, true);
    }
  });

});
