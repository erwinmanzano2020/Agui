import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import { NextResponse } from "next/server";

import { AppFeature } from "@/lib/auth/permissions";
import * as featureGuard from "@/lib/auth/feature-guard";
import * as identityServer from "@/lib/identity/entity-server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import { resolveHrRouteActorContext } from "../route-guard-order";

describe("resolveHrRouteActorContext", () => {
  afterEach(() => mock.restoreAll());

  it("returns unauthenticated response when no user session", async () => {
    const unauthenticated = NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) as never,
    );
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const result = await resolveHrRouteActorContext({
      routeName: "api/hr/test",
      features: [AppFeature.PAYROLL],
      onUnauthenticated: () => unauthenticated,
      onEntityNotLinked: () => NextResponse.json({ error: "Account not linked" }, { status: 403 }),
    });

    assert.equal(result, unauthenticated);
    assert.equal(featureMock.mock.callCount(), 0);
  });

  it("returns account-not-linked response when entity is missing", async () => {
    const notLinked = NextResponse.json({ error: "Account not linked" }, { status: 403 });
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => null);
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const result = await resolveHrRouteActorContext({
      routeName: "api/hr/test",
      features: [AppFeature.PAYROLL],
      onUnauthenticated: () => NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      onEntityNotLinked: () => notLinked,
    });

    assert.equal(result, notLinked);
    assert.equal(featureMock.mock.callCount(), 0);
  });

  it("returns 500 when entity resolution throws", async () => {
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      throw new Error("entity resolver unavailable");
    });
    const featureMock = mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => null);

    const result = await resolveHrRouteActorContext({
      routeName: "api/hr/test",
      features: [AppFeature.PAYROLL],
      onUnauthenticated: () => NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      onEntityNotLinked: () => NextResponse.json({ error: "Account not linked" }, { status: 403 }),
    });

    assert.ok(result instanceof NextResponse);
    assert.equal(result.status, 500);
    assert.equal(featureMock.mock.callCount(), 0);
  });

  it("returns feature guard deny response", async () => {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mock.method(supabaseServer, "createServerSupabaseClient", async () =>
      ({ auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } }) as never,
    );
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => "entity-1");
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => denied);

    const result = await resolveHrRouteActorContext({
      routeName: "api/hr/test",
      features: [AppFeature.PAYROLL],
      onUnauthenticated: () => NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      onEntityNotLinked: () => NextResponse.json({ error: "Account not linked" }, { status: 403 }),
    });

    assert.equal(result, denied);
  });

  it("returns success context and keeps auth -> entity -> feature order", async () => {
    const order: string[] = [];
    const supabaseStub = {
      auth: {
        getUser: async () => {
          order.push("auth");
          return { data: { user: { id: "user-1" } }, error: null };
        },
      },
    } as never;
    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabaseStub);
    mock.method(supabaseService, "getServiceSupabase", () => ({}) as never);
    mock.method(identityServer, "resolveEntityIdForUser", async () => {
      order.push("entity");
      return "entity-1";
    });
    mock.method(featureGuard, "requireAnyFeatureAccessApi", async () => {
      order.push("feature");
      return null;
    });

    const result = await resolveHrRouteActorContext({
      routeName: "api/hr/test",
      features: [AppFeature.PAYROLL],
      onUnauthenticated: () => NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
      onEntityNotLinked: () => NextResponse.json({ error: "Account not linked" }, { status: 403 }),
    });

    assert.equal((result as { userId: string }).userId, "user-1");
    assert.equal((result as { entityId: string }).entityId, "entity-1");
    assert.equal((result as { supabase: unknown }).supabase, supabaseStub);
    assert.deepEqual(order, ["auth", "entity", "feature"]);
  });
});
