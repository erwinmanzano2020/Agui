import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMyEntityId } from "@/lib/authz";
import { evaluatePolicy, listPoliciesForCurrentUser } from "@/lib/policy/server";
import { buildTilesResponse } from "@/lib/tiles/compute";
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

  constructor(options: {
    user: { id: string; email?: string | null; phone?: string | null };
    tables?: Record<string, QueryResult | QueryResult[]>;
  }) {
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
    const [result, ...rest] = queue.length > 0 ? queue : [{ data: null, error: null }];
    this.tableResults[table] = rest;

    const query = Promise.resolve(result) as QueryPromise;
    query.select = (_columns?: string) => query;
    query.eq = (_column: string, _value: unknown) => query;
    query.in = (_column: string, _values: unknown[]) => query;
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
          { data: null, error: null },
          { data: { entity_id: "entity-email" }, error: null },
        ],
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-email");
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
                policy_key: "houses:create",
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
                policy_key: "houses:create",
                action: "houses:create",
                resource: "houses",
              },
            ],
            error: null,
          },
        ],
      },
    });

    const entityId = await getMyEntityId(supabase as unknown as DatabaseClient);
    assert.strictEqual(entityId, "entity-789");

    const policies = await listPoliciesForCurrentUser(supabase as unknown as DatabaseClient);
    assert.deepStrictEqual(policies.map((policy) => policy.key), ["houses:create"]);

    const allowed = await evaluatePolicy({ action: "houses:create" }, supabase as unknown as DatabaseClient);
    assert.ok(allowed);

    const tiles = buildTilesResponse(
      baseTilesInput({
        policies: policies.map((policy) => policy.key),
        businessCount: 0,
      }),
    );

    assert.ok(tiles.home.some((tile) => tile.kind === "start-business"));
  });
});
