import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import * as authz from "@/lib/authz/server";
import * as events from "@/lib/events/server";
import * as identity from "@/lib/identity/entity-server";
import * as policy from "@/lib/policy/server";
import * as supabaseServer from "@/lib/supabase/server";
import * as supabaseService from "@/lib/supabase-service";
import * as guilds from "@/lib/guilds/server";

import * as employment from "../employment";
import { createBusinessWizard } from "../actions";

type SupabaseMockOptions = {
  houseInsertError?: unknown;
  existingGuildId?: string | null;
  membershipGuildId?: string | null;
  membershipGuildSlug?: string | null;
  membershipHouseId?: string | null;
};

type SupabaseMockState = {
  houseInserts: Record<string, unknown>[];
  branchInserts: Record<string, unknown>[];
  roleAssignments: Record<string, unknown>[];
  guildInserts: Record<string, unknown>[];
  slugChecks: { table: string; slug: string }[];
  guildLookups: string[];
  membershipLookups: string[];
};

type MaybeSingleResult = { data: unknown; error: unknown };

type SelectChain = {
  eq: (column: string, value: unknown) => {
    maybeSingle?: () => Promise<MaybeSingleResult>;
    order?: (_column: string, _opts?: Record<string, unknown>) => {
      limit: (_count: number) => { maybeSingle: () => Promise<MaybeSingleResult> };
    };
  };
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
    slugChecks: [],
    guildLookups: [],
    membershipLookups: [],
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
              eq(column: string, value: unknown) {
                state.guildLookups.push(String(value));
                return {
                  async maybeSingle() {
                    if (options.existingGuildId === null && column === "slug") {
                      return { data: null, error: null };
                    }

                    if (column === "id" && options.membershipGuildId) {
                      return {
                        data: { id: options.membershipGuildId, slug: options.membershipGuildSlug ?? "member-guild" },
                        error: null,
                      } satisfies MaybeSingleResult;
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
              eq(column: string, value: unknown) {
                if (column === "slug") {
                  state.slugChecks.push({ table: "houses", slug: String(value) });
                  return {
                    async maybeSingle() {
                      return { data: null, error: null };
                    },
                  };
                }

                if (column === "id") {
                  return {
                    async maybeSingle() {
                      if (!options.membershipGuildId) {
                        return { data: null, error: null };
                      }
                      return {
                        data: {
                          guild_id: options.membershipGuildId,
                        },
                        error: null,
                      } satisfies MaybeSingleResult;
                    },
                  };
                }

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
          select() {
            return {
              eq(_column: string, value: unknown) {
                state.membershipLookups.push(String(value));
                return {
                  order() {
                    return {
                      limit() {
                        return {
                          async maybeSingle() {
                            if (!options.membershipGuildId) {
                              return { data: null, error: null };
                            }
                            return {
                              data: { house_id: options.membershipHouseId ?? "house-member" },
                              error: null,
                            } satisfies MaybeSingleResult;
                          },
                        };
                      },
                    };
                  },
                };
              },
            } satisfies SelectChain;
          },
          async upsert(values: Record<string, unknown>) {
            state.roleAssignments.push(values);
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
    const serviceSpy = mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
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
    assert.equal(state.branchInserts.length, 1);
    assert.equal(state.roleAssignments.length, 2);
    assert.equal(state.membershipLookups.length > 0, true);
    assert.equal(serviceSpy.mock.callCount(), 1);
  });

  it("reuses an existing guild when one is present", async () => {
    const { supabase, state } = createSupabaseMock({ existingGuildId: "guild-existing" });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    const serviceSpy = mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
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
    assert.equal(state.houseInserts[0]?.guild_id, "guild-existing");
    assert.equal(
      state.guildLookups.includes("existing-guild-co") || state.guildLookups.includes("guild-existing"),
      true,
    );
    assert.equal(serviceSpy.mock.callCount(), 1);
  });

  it("reuses a guild linked to the entity when slug does not match", async () => {
    const { supabase, state } = createSupabaseMock({
      existingGuildId: null,
      membershipGuildId: "guild-member",
      membershipGuildSlug: "member-slug",
    });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    const serviceSpy = mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
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
      name: "Membership Guild Co",
      slug: "membership-guild-co",
      businessType: "grocery",
      logoUrl: "",
      slogan: "",
    });

    assert.equal(result.status, "success");
    assert.equal(state.guildInserts.length, 0);
    assert.equal(state.membershipLookups.length > 0, true);
    assert.equal(state.houseInserts[0]?.guild_id, "guild-member");
    assert.equal(serviceSpy.mock.callCount(), 1);
  });

  it("surfaces insert errors as form errors", async () => {
    const { supabase, state } = createSupabaseMock({ houseInsertError: { message: "constraint violation" } });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
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
    assert.equal(state.houseInserts.length, 2);
    assert.equal(state.houseInserts[0]?.guild_id, "guild-1");
    assert.equal(state.houseInserts[1]?.guild_id, "guild-1");
  });

  it("surfaces guild preparation failures", async () => {
    const { supabase } = createSupabaseMock({ existingGuildId: null });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
    mock.method(policy, "evaluatePolicy", async () => true);
    mock.method(identity, "ensureEntityForUser", async () => "entity-1");
    mock.method(authz, "currentEntityIsGM", async () => true);
    mock.method(guilds, "getOrCreateGuildForWorkspace", async () => {
      throw new Error("guild write blocked");
    });

    const result = await createBusinessWizard({
      name: "Guild Failure",
      slug: "guild-failure",
      businessType: "retail",
      logoUrl: "",
      slogan: "",
    });

    assert.equal(result.status, "error");
    assert.match(result.formError, /Failed to prepare workspace guild: .*guild write blocked/);
  });

  it("fails fast when guild provisioning does not return an id", async () => {
    const { supabase, state } = createSupabaseMock({ existingGuildId: null });

    mock.method(supabaseServer, "createServerSupabaseClient", async () => supabase as never);
    mock.method(supabaseService, "getServiceSupabase", () => supabase as never);
    mock.method(policy, "evaluatePolicy", async () => true);
    mock.method(identity, "ensureEntityForUser", async () => "entity-1");
    mock.method(authz, "currentEntityIsGM", async () => true);
    mock.method(employment, "ensureCreatorEmployment", async () => ({
      employmentId: "employment-1",
      roleId: "role-owner",
      roleSlug: "house_owner",
    }));
    mock.method(events, "emitEvent", async () => {});
    mock.method(guilds, "getOrCreateGuildForWorkspace", async () => ({ id: "", slug: "bad" } as never));

    const result = await createBusinessWizard({
      name: "Missing Guild Id", 
      slug: "missing-guild-id", 
      businessType: "grocery", 
      logoUrl: "", 
      slogan: "", 
    });

    assert.equal(result.status, "error");
    assert.match(result.formError, /Failed to prepare workspace guild/);
    assert.equal(state.houseInserts.length, 0);
  });
});
