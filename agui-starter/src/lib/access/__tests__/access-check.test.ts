import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { AuthorizationDeniedError } from "@/lib/access/access-errors";
import type { AccessContext } from "@/lib/access/access-resolver";
import * as accessCheck from "@/lib/access/access-check";
import * as featureGuard from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import * as hrAccess from "@/lib/hr/access";
import * as policy from "@/lib/policy/server";
import * as supabaseServer from "@/lib/supabase/server";

const baseContext: AccessContext = {
  userId: "00000000-0000-0000-0000-000000000999",
  scopeType: "house",
  scopeId: "00000000-0000-0000-0000-000000000111",
  roles: { PLATFORM: [], GUILD: [], HOUSE: [] },
  permissions: [],
  membership: { isMember: true, roleCount: 1, scopeRoleScope: "HOUSE" },
  elevatedAuthority: { hasOperationalElevatedAuthority: false, sourceRole: null },
};

describe("access-check authorization denials", () => {
  afterEach(() => mock.restoreAll());

  it("throws AuthorizationDeniedError for non-member", () => {
    const context: AccessContext = {
      ...baseContext,
      membership: { isMember: false, roleCount: 0, scopeRoleScope: "HOUSE" },
    };

    assert.throws(() => accessCheck.requireMembership(context), AuthorizationDeniedError);
  });

  it("throws AuthorizationDeniedError for module denial", async () => {
    mock.method(featureGuard, "requireFeatureAccess", async () => {
      throw { digest: "NEXT_REDIRECT;replace;/403?dest=%2Femployees" };
    });

    await assert.rejects(
      () => accessCheck.requireModuleAccess(AppFeature.HR, baseContext, { dest: "/employees" }),
      AuthorizationDeniedError,
    );
  });

  it("throws AuthorizationDeniedError for HR business access denial", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: false }) as never);

    await assert.rejects(
      () => accessCheck.requireHrBusinessAccess(baseContext),
      AuthorizationDeniedError,
    );
  });

  it("throws AuthorizationDeniedError for permission denial", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () => ({}) as never);
    mock.method(hrAccess, "requireHrAccess", async () => ({ allowed: true }) as never);
    mock.method(policy, "evaluatePolicy", async () => false);

    await assert.rejects(
      () => accessCheck.requireActionPermission("read", "hr.employee", baseContext),
      AuthorizationDeniedError,
    );
  });

  it("preserves backend failures from policy evaluation", async () => {
    mock.method(policy, "evaluatePolicy", async () => {
      throw new Error("policy backend down");
    });

    await assert.rejects(
      () => accessCheck.requireActionPermission("read", "inventory.item", baseContext),
      /policy backend down/,
    );
  });
});
