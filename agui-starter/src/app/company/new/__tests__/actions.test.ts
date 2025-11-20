import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as authz from "@/lib/authz/server";
import * as events from "@/lib/events/server";
import * as identity from "@/lib/identity/entity-server";
import * as policy from "@/lib/policy/server";
import * as supabaseServer from "@/lib/supabase/server";

import * as employment from "../employment";
import { createBusinessWizard } from "../actions";

type SupabaseMockOptions = {
  houseInsertError?: unknown;
  existingGuildId?: string | null;
};

type SupabaseMockState = {
  houseInserts: Record<string, unknown>[];
  branchInserts: Record<string, unknown>[];
  roleAssignments: Record<string, unknown>[];
  guildInserts: Record<string, unknown>[];
  guildRoleAssignments: Record<string, unknown>[];
  slugChecks: { table: string; slug: string }[];
  guildLookups: string[];
};

type MaybeSingleResult = { data: unknown; error: unknown };

type SelectChain = {
  eq: (column: string, value: unknown) => { maybeSingle: () => Promise<MaybeSingleResult> };
  order?: (_column: string, _opts: Record<string, unknown>) => {
    limit: (_count: number) => { maybeSingle: () => Promise<MaybeSingleResult> };
  };
  maybeSingle?: () => Promise<MaybeSingleResult>;
};

type InsertChain = {
  select: (_columns: string) => { maybeSingle: () => Promise<MaybeSingleResult> };
};

type SupabaseMock = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } } | null; error: unknown }>;
  };
  from: (table: string) => unknown;
};

function createSupabaseMock(options: SupabaseMockOptions = {}): { supabase: SupabaseMock; state: SupabaseMockState } {
  const state: SupabaseMockState = {
    houseInserts: [],
    branchInserts: [],
    roleAssignments: [],
    guildInserts: [],
    guildRoleAssignments: [],
    slugChecks: [],
    guildLookups: [],
  };

  const supabase: SupabaseMock = {
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1" } }, error: null };
      },
    },
    from(table: string) {
      if (table === "guilds") {
        return {
          select() {
            return {
              eq(_column: string, value: unknown) {
                state.guildLookups.push(String(value));
                return {
                  async maybeSingle() {
                    if (options.existingGuildId === null) {
                      return { data: null, error: null };
                    }
                    return { data: { id: options.existingGuildId ?? "guild-1", slug: value }, error: null };
                  },
                };
              },
              order() {
                return {
                  limit() {
                    return {
                      async maybeSingle() {
                        if (options.existingGuildId === null) {
                          return { data: null, error: null };
                        }
                        return { data: { id: options.existingGuildId ?? "guild-1", slug: "guild-1" }, error: null };
                      },
                    };
                  },
                };
              },
            } satisfies SelectChain;
          },
          insert(values: Record<string, unknown>) {
            state.guildInserts.push(values);
            return {
              select() {
                return {
                  async maybeSingle() {
                    const slug = typeof values.slug === "string" ? values.slug : "guild-created";
                    return { data: { ...(values ?? {}), id: "guild-created", slug }, error: null };
                  },
                };
              },
            } satisfies InsertChain;
          },
        };
      }

      if (table === "houses") {
        return {
          select() {
            return {
              eq(_column: string, value: unknown) {
                state.slugChecks.push({ table: "houses", slug: String(value) });
                return {
                  async maybeSingle() {
                    return { data: null, error: null };
                  },
                };
              },
            } satisfies SelectChain;
          },
          insert(values: Record<string, unknown>) {
            state.houseInserts.push(values);
            return {
              select() {
                return {
                  async maybeSingle() {
                    if (options.houseInsertError) {
                      return { data: null, error: options.houseInsertError };
                    }
                    return {
                      data: {
                        id: "house-1",
                        slug: values.slug ?? "generated-slug",
                        name: values.name ?? "House Name",
                      },
                      error: null,
                    } satisfies MaybeSingleResult;
                  },
                };
              },
            } satisfies InsertChain;
          },
          update() {
            return {
              async eq() {
                return undefined;
              },
            };
          },
        };
      }

      if (table === "house_roles") {
        return {
          async upsert(values: Record<string, unknown>) {
            state.roleAssignments.push(values);
            return { data: null, error: null };
          },
        };
      }

      if (table === "guild_roles") {
        return {
          async upsert(values: Record<string, unknown>) {
            state.guildRoleAssignments.push(values);
            return { data: null, error: null };
          },
        };
      }

      if (table === "branches") {
        return {
          insert(values: Record<string, unknown>) {
            state.branchInserts.push(values);
            return {
              select() {
                return {
                  async maybeSingle() {
                    return {
                      data: { id: "branch-1", name: "Main Branch", slug: `${values.house_id}-main` },
                      error: null,
                    } satisfies MaybeSingleResult;
                  },
                };
              },
            } satisfies InsertChain;
          },
        };
      }

      if (table === "entity_policy_grants" || table === "policies") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: null };
                  },
                };
              },
            } satisfies SelectChain;
          },
          delete() {
            return {
              async eq() {
                return { error: null };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { supabase, state };
}

describe("createBusinessWizard", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("creates a house with guild, branch, and roles", async () => {
    const { supabase, state } = createSupabaseMock({ existingGuildId: null });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(policy, "evaluatePolicy", async () => true);
    mock.method(identity, "ensureEntityForUser", async () => "entity-1");
    mock.method(authz, "currentEntityIsGM", async () => true);
    mock.method(employment, "ensureCreatorEmployment", async () => ({
      employmentId: "employment-1",
      roleId: "role-owner",
      roleSlug: "house_owner",
    }));
    mock.method(events, "emitEvent", async () => {});

    const result = await createBusinessWizard({
      name: "Test Grocery",
      slug: "test-grocery",
      businessType: "grocery",
      logoUrl: "",
      slogan: "",
    });

    assert.equal(result.status, "success");
    assert.equal(state.houseInserts.length, 1);
    assert.equal(state.houseInserts[0]?.guild_id, "guild-created");
    assert.equal(state.houseInserts[0]?.house_type, "RETAIL");
    assert.equal(state.guildInserts.length, 1);
    assert.equal(state.guildRoleAssignments.length, 2);
    assert.equal(state.branchInserts.length, 1);
    assert.equal(state.roleAssignments.length, 2);
  });

  it("reuses an existing guild when one is present", async () => {
    const { supabase, state } = createSupabaseMock({ existingGuildId: "guild-existing" });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(policy, "evaluatePolicy", async () => true);
    mock.method(identity, "ensureEntityForUser", async () => "entity-1");
    mock.method(authz, "currentEntityIsGM", async () => true);
    mock.method(employment, "ensureCreatorEmployment", async () => ({
      employmentId: "employment-1",
      roleId: "role-owner",
      roleSlug: "house_owner",
    }));
    mock.method(events, "emitEvent", async () => {});

    const result = await createBusinessWizard({
      name: "Existing Guild Co",
      slug: "existing-guild-co",
      businessType: "grocery",
      logoUrl: "",
      slogan: "",
    });

    assert.equal(result.status, "success");
    assert.equal(state.guildInserts.length, 0);
    assert.equal(state.guildLookups.length > 0, true);
    assert.equal(state.houseInserts[0]?.guild_id, "guild-existing");
    assert.equal(state.guildRoleAssignments.length, 2);
  });

  it("surfaces insert errors as form errors", async () => {
    const { supabase } = createSupabaseMock({ houseInsertError: { message: "constraint violation" } });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(policy, "evaluatePolicy", async () => true);
    mock.method(identity, "ensureEntityForUser", async () => "entity-1");
    mock.method(authz, "currentEntityIsGM", async () => true);
    mock.method(employment, "ensureCreatorEmployment", async () => ({
      employmentId: null,
      roleId: "role-owner",
      roleSlug: "house_owner",
    }));
    mock.method(events, "emitEvent", async () => {});

    const result = await createBusinessWizard({
      name: "Error House",
      slug: "error-house",
      businessType: "retail",
      logoUrl: "",
      slogan: "",
    });

    assert.equal(result.status, "error");
    assert.match(result.formError, /constraint violation|Failed to create business/);
  });
});
