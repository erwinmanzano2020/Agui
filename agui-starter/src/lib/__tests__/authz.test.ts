import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMyEntityId } from "@/lib/authz";
import {
  evaluatePolicyFromSet,
  getCurrentEntityAndPolicies,
  listPoliciesForCurrentUser,
} from "@/lib/policy/server";
import { buildTilesResponse } from "@/lib/tiles/compute";
import { appendAuthzDebug } from "@/lib/tiles/server";
import type { BuildTilesInput } from "@/lib/tiles/types";

type DatabaseClient = import("@supabase/supabase-js").SupabaseClient;

type QueryResult = { data: unknown; error: unknown };

type QueryPromise = Promise<QueryResult> & {
  select: (_columns?: string) => QueryPromise;
  eq: (_column: string, _value: unknown) => QueryPromise;
  in: (_column: string, _values: unknown[]) => QueryPromise;
  limit: (_count: number) => QueryPromise;
  maybeSingle: () => Promise<QueryResult>;
};

class MockSupabase {
  readonly auth: {
    getUser: () => Promise<{ data: { user: { id: string; email?: string | null; phone?: string | null } }; error: null }>;
  };

  private readonly tableResults: Record<string, QueryResult[]>;
  private readonly handlers?: {
    in?: (context: { table: string; column: string; values: unknown[] }) => QueryResult | void;
  };

  constructor(options: {
    user: { id: string; email?: string | null; phone?: string | null };
    tables?: Record<string, QueryResult | QueryResult[]>;
    handlers?: MockSupabase["handlers"];
  }) {
    this.handlers = options.handlers;
    this.tableResults = {};
    for (const [table, payload] of Object.entries(options.tables ?? {})) {
      this.tableResults[table] = Array.isArray(payload) ? [...payload] : [payload];
    }

    this.auth = {
      getUser: async () => ({ data: { user: options.user }, error: null }) as const,
    };
  }

  from(table: string) {
    const queue = this.tableResults[table] ?? [{ data: null, error: null }];
    let result: QueryResult;
    if (queue.length === 0) {
      result = { data: null, error: null };
      this.tableResults[table] = [];
    } else if (queue.length === 1) {
      result = queue[0];
      this.tableResults[table] = queue;
    } else {
      [result] = queue;
      this.tableResults[table] = queue.slice(1);
    }

    return this.createQuery(result, table);
  }

  private createQuery(initialResult: QueryResult, table: string) {
    let result = initialResult;
    const query = Promise.resolve().then(() => result) as QueryPromise;
    query.select = (_columns?: string) => query;
    query.eq = (_column: string, _value: unknown) => query;
    query.in = (column: string, values: unknown[]) => {
      const handlerResult = this.handlers?.in?.({ table, column, values });
      if (handlerResult) {
        result = handlerResult;
      }
      return query;
    };
    query.limit = (_count: number) => query;
    query.maybeSingle = async () => result;

    return query;
  }
}

function baseTilesInput(overrides: Partial<BuildTilesInput>): BuildTilesInput {
  return {
    loyalties: [],
    workspaces: [],
    tileAssignments: [],
    policies: [],
    gmAccess: false,
    inboxUnreadCount: 0,
    apps: [],
    visibilityRules: [],
    businessCount: 0,
    alwaysShowStartBusinessTile: false,
    ...overrides,
  } satisfies BuildTilesInput;
}

describe("authz entity resolution", () => {
  it("resolves the entity via the simple identifier resolver", async () => {
    const supabase = new MockSupabase({
      user: { id: "simple-user", email: "simple@example.com" },
      tables: {
        entity_identifiers: {
          data: [{ entity_id: "entity-simple" }],
          error: null,
        },
        entity_policies: {
          data: [
            {
              policy_id: "policy-simple",
              policy: { key: "houses:create" },
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
      },
    });

    const authzState = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "simple",
      debug: false,
      lookupClient: supabase as unknown as DatabaseClient,
    });

    assert.strictEqual(authzState.entityId, "entity-simple");
    assert.strictEqual(authzState.source, "simpleResolver");
    assert.deepStrictEqual(authzState.policyKeys, ["houses:create"]);
  });

  it("avoids invalid enum variants and still resolves the entity", async () => {
    const supabase = new MockSupabase({
      user: { id: "enum-user", email: "Enum@example.com" },
      tables: {
        entity_identifiers: {
          data: [
            { entity_id: "entity-enum" },
            { entity_id: "entity-enum" },
          ],
          error: null,
        },
        entity_policies: {
          data: [
            {
              policy_id: "policy-enum",
              policy: { key: "houses:create" },
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
      },
      handlers: {
        in: ({ column, values }) => {
          if (column === "identifier_type" && values.includes("AUTH_UID")) {
            return { data: null, error: { message: "invalid input value for enum" } };
          }
          return undefined;
        },
      },
    });

    const authzState = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "enum-simple",
      debug: true,
      lookupClient: supabase as unknown as DatabaseClient,
    });

    assert.strictEqual(authzState.error, null);
    assert.strictEqual(authzState.entityId, "entity-enum");
    assert.strictEqual(authzState.source, "simpleResolver");
    assert.deepStrictEqual(authzState.policyKeys, ["houses:create"]);
  });

  it("treats entity identifier permission errors as non-fatal when auth uid is present", async () => {
    const supabase = new MockSupabase({
      user: {
        id: "a45f083f-ee47-42f3-8854-2180589d18b3",
        email: "erwinmanzano24@gmail.com",
      },
      tables: {
        entity_identifiers: {
          data: null,
          error: { message: "permission denied for table entity_identifiers" },
        },
        entity_policies: {
          data: [
            {
              policy_id: "policy-auth-uid",
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
        policies: {
          data: [
            { id: "policy-auth-uid", key: "houses:create" },
          ],
          error: null,
        },
      },
    });

    const authzState = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "permission-denied",
      debug: false,
      lookupClient: supabase as unknown as DatabaseClient,
    });

    assert.strictEqual(authzState.entityId, "a45f083f-ee47-42f3-8854-2180589d18b3");
    assert.strictEqual(authzState.source, "simpleResolver");
    assert.strictEqual(authzState.error, "permission denied for table entity_identifiers");
    assert.deepStrictEqual(authzState.policyKeys, ["houses:create"]);

    const allowed = evaluatePolicyFromSet(authzState.policies, { action: "houses:create" });
    assert.ok(allowed);
  });

  it("hydrates policies via fallback when primary policy lookup fails but identifier errors persist", async () => {
    const supabase = new MockSupabase({
      user: { id: "a45f083f-ee47-42f3-8854-2180589d18b3", email: "erwinmanzano24@gmail.com" },
      tables: {
        entity_identifiers: {
          data: null,
          error: { message: "permission denied for table entity_identifiers" },
        },
        entity_policies: {
          data: null,
          error: { message: "permission denied for table entity_policies" },
        },
      },
    });

    const serviceFallback = new MockSupabase({
      user: { id: "a45f083f-ee47-42f3-8854-2180589d18b3", email: "erwinmanzano24@gmail.com" },
      tables: {
        entity_policies: {
          data: [
            {
              policy_id: "policy-auth-uid",
              policy: { key: "houses:create" },
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
      },
    });

    const authzState = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "permission-fallback",
      debug: false,
      lookupClient: supabase as unknown as DatabaseClient,
      policyFallbackClient: serviceFallback as unknown as DatabaseClient,
    });

    assert.strictEqual(authzState.entityId, "a45f083f-ee47-42f3-8854-2180589d18b3");
    assert.strictEqual(authzState.source, "simpleResolver");
    assert.ok(authzState.error?.includes("permission denied for table entity_identifiers"));
    assert.ok(authzState.error?.includes("policy error: permission denied for table entity_policies"));
    assert.strictEqual(authzState.policyError, "permission denied for table entity_policies");
    assert.deepStrictEqual(authzState.policyKeys, ["houses:create"]);
  });

  it("returns the entity id linked via accounts", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-1", email: "owner@example.com" },
      tables: {
        accounts: { data: { entity_id: "entity-123" }, error: null },
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-123");
  });

  it("falls back to auth_uid and email identifiers when no account exists", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-2", email: "fallback@example.com" },
      tables: {
        accounts: { data: null, error: null },
        entity_identifiers: [
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: { message: "column entity_identifiers.value_norm does not exist" } },
          { data: [{ entity_id: "entity-email" }], error: null },
        ],
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-email");
  });

  it("falls back to alternate identifier schema when identifier_type is unavailable", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-kind", email: "kind@example.com" },
      tables: {
        accounts: { data: null, error: null },
        entity_identifiers: [
          { data: null, error: { message: "column entity_identifiers.identifier_type does not exist" } },
          { data: [{ entity_id: "entity-kind" }], error: null },
        ],
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-kind");
  });

  it("integrates entity resolution with policy checks and tiles", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-3", email: "creator@example.com" },
      tables: {
        accounts: [
          { data: { entity_id: "entity-789" }, error: null },
          { data: { entity_id: "entity-789" }, error: null },
          { data: { entity_id: "entity-789" }, error: null },
        ],
        entity_policies: [
          {
            data: [
              {
                policy_id: "policy-1",
                policy: { key: "houses:create" },
                action: "houses:create",
                resource: "houses",
              },
            ],
            error: null,
          },
          {
            data: [
              {
                policy_id: "policy-1",
                key: "houses:create",
                action: "houses:create",
                resource: "houses",
              },
            ],
            error: null,
          },
        ],
      },
    });

    const authzState = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "test",
      debug: false,
      lookupClient: supabase as unknown as DatabaseClient,
    });

    assert.strictEqual(authzState.entityId, "entity-789");
    assert.deepStrictEqual(authzState.policyKeys, ["houses:create"]);

    const policies = await listPoliciesForCurrentUser(supabase as unknown as DatabaseClient, {
      lookupClient: supabase as unknown as DatabaseClient,
    });
    assert.deepStrictEqual(policies.map((policy) => policy.key), ["houses:create"]);

    const allowed = evaluatePolicyFromSet(authzState.policies, { action: "houses:create" });
    assert.ok(allowed);

    const tiles = buildTilesResponse(
      baseTilesInput({
        policies: authzState.policyKeys,
        businessCount: 0,
      }),
    );

    assert.ok(tiles.home.some((tile) => tile.kind === "start-business"));

    const augmented = appendAuthzDebug(tiles, {
      entityId: authzState.entityId,
      policyKeys: authzState.policyKeys,
      source: authzState.source,
      error: authzState.error,
    });

    assert.deepStrictEqual(augmented._debug?.authz, {
      entityId: "entity-789",
      policyKeys: ["houses:create"],
      source: "accounts",
      error: null,
    });
  });

  it("resolves policies when the entity is linked by auth uid and email identifiers", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-4", email: "identifier@example.com" },
      tables: {
        accounts: { data: null, error: null },
        entity_identifiers: [
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: { message: "column entity_identifiers.value_norm does not exist" } },
          { data: [], error: null },
          { data: [{ entity_id: "entity-identifiers" }], error: null },
        ],
        entity_policies: {
          data: [
            {
              policy_id: "policy-2",
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
        policies: {
          data: [
            { id: "policy-2", key: "houses:create" },
          ],
          error: null,
        },
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-identifiers");

    const { entityId: resolvedEntity, policyKeys, policies } = await getCurrentEntityAndPolicies(
      supabase as unknown as DatabaseClient,
      { context: "test-identifiers", debug: false, lookupClient: supabase as unknown as DatabaseClient },
    );

    assert.strictEqual(resolvedEntity, "entity-identifiers");
    assert.deepStrictEqual(policyKeys, ["houses:create"]);
    assert.ok(evaluatePolicyFromSet(policies, { action: "houses:create" }));
  });

  it("returns policies for identifiers with mixed casing", async () => {
    const supabase = new MockSupabase({
      user: { id: "user-mixed", email: "ErwinManzano24@gmail.com" },
      tables: {
        accounts: { data: null, error: null },
        entity_identifiers: [
          { data: [], error: null },
          { data: [], error: null },
          { data: null, error: { message: "column entity_identifiers.value_norm does not exist" } },
          { data: [{ entity_id: "entity-mixed" }], error: null },
        ],
        entity_policies: {
          data: [
            {
              policy_id: "policy-3",
              action: "houses:create",
              resource: "houses",
            },
          ],
          error: null,
        },
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-mixed");

    const authz = await getCurrentEntityAndPolicies(supabase as unknown as DatabaseClient, {
      context: "mixed-case",
      debug: false,
      lookupClient: supabase as unknown as DatabaseClient,
    });

    assert.strictEqual(authz.entityId, "entity-mixed");
    assert.deepStrictEqual(authz.policyKeys, ["houses:create"]);

    const tiles = appendAuthzDebug(
      buildTilesResponse(
        baseTilesInput({
          policies: authz.policyKeys,
          businessCount: 0,
        }),
      ),
      { entityId: authz.entityId, policyKeys: authz.policyKeys, source: authz.source, error: authz.error },
    );

    assert.deepStrictEqual(tiles._debug?.authz, {
      entityId: "entity-mixed",
      policyKeys: ["houses:create"],
      source: authz.source,
      error: authz.error ?? null,
    });
  });
});
