import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { POST } from "../route";

describe("POST /api/hr/employees/lookup route-entry drift guard", () => {
  afterEach(() => mock.restoreAll());

  it("returns canonical unauthenticated envelope", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never,
    );
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        body: JSON.stringify({ houseId: "33333333-3333-4333-8333-333333333333" }),
      }) as never,
    );

    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "Not authenticated");
    assert.equal(featureMock.mock.callCount(), 0);
  });

  it("preserves auth -> entity -> feature route-entry ordering", async () => {
    const order: string[] = [];
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({
        auth: {
          getUser: async () => {
            order.push("auth");
            return { data: { user: { id: "user-1" } }, error: null };
          },
        },
      }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      order.push("entity");
      return "entity-1";
    });
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });

    const response = await POST(
      new Request("http://localhost/api/hr/employees/lookup", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );

    assert.equal(response.status, 400);
    assert.deepEqual(order, ["auth", "entity", "feature"]);
  });
});
