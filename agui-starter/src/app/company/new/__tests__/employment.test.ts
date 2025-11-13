import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ensureCreatorEmployment, resolveCreatorEmploymentRole } from "../employment";

type RoleRow = {
  id: string;
  slug: string;
  scope: string;
};

type SupabaseMockOptions = {
  roleRows?: RoleRow[];
  roleError?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
  upsertError?: unknown;
};

type SupabaseMockState = {
  rpcCalls: number;
  upsertCalls: number;
  lastRpcName: string | null;
  lastRpcParams: Record<string, unknown> | null;
};

type SupabaseMock = {
  from: (table: string) => unknown;
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

function createSupabaseMock(options: SupabaseMockOptions = {}): { supabase: SupabaseMock; state: SupabaseMockState } {
  const state: SupabaseMockState = {
    rpcCalls: 0,
    upsertCalls: 0,
    lastRpcName: null,
    lastRpcParams: null,
  };

  const supabase: SupabaseMock = {
    from(table: string) {
      if (table === "roles") {
        return {
          async select() {
            return {
              data: options.roleRows ?? [],
              error: options.roleError ?? null,
            };
          },
        };
      }

      if (table === "employments") {
        return {
          async upsert(_values: Record<string, unknown>) {
            void _values;
            state.upsertCalls += 1;
            if (options.upsertError) {
              return { data: null, error: options.upsertError };
            }
            return { data: null, error: null };
          },
        };
      }

      throw new Error(`Unexpected table requested: ${table}`);
    },
    async rpc(name: string, params: Record<string, unknown>) {
      state.rpcCalls += 1;
      state.lastRpcName = name;
      state.lastRpcParams = params;

      if (options.rpcError) {
        return { data: null, error: options.rpcError };
      }

      return { data: options.rpcData ?? null, error: null };
    },
  };

  return { supabase, state };
}

describe("resolveCreatorEmploymentRole", () => {
  it("prefers the house owner role when available", async () => {
    const { supabase } = createSupabaseMock({
      roleRows: [
        { id: "staff", slug: "house_staff", scope: "HOUSE" },
        { id: "owner-role", slug: "house_owner", scope: "HOUSE" },
        { id: "manager-role", slug: "house_manager", scope: "HOUSE" },
      ],
    });

    const result = await resolveCreatorEmploymentRole(supabase);
    assert.equal(result.roleId, "owner-role");
    assert.equal(result.roleSlug, "house_owner");
  });

  it("falls back to the house manager role when owner is missing", async () => {
    const { supabase } = createSupabaseMock({
      roleRows: [
        { id: "staff", slug: "house_staff", scope: "HOUSE" },
        { id: "manager-role", slug: "house_manager", scope: "HOUSE" },
      ],
    });

    const result = await resolveCreatorEmploymentRole(supabase);
    assert.equal(result.roleId, "manager-role");
    assert.equal(result.roleSlug, "house_manager");
  });

  it("throws when no qualifying roles exist", async () => {
    const { supabase } = createSupabaseMock({
      roleRows: [{ id: "staff", slug: "house_staff", scope: "HOUSE" }],
    });

    await assert.rejects(
      resolveCreatorEmploymentRole(supabase),
      /No eligible owner or manager role found/,
    );
  });
});

describe("ensureCreatorEmployment", () => {
  it("uses the onboard_employee RPC when it is available", async () => {
    const { supabase, state } = createSupabaseMock({
      roleRows: [
        { id: "owner-role", slug: "house_owner", scope: "HOUSE" },
      ],
      rpcData: { employment: { id: "employment-1" } },
    });

    const result = await ensureCreatorEmployment(supabase, "house-1", "entity-1");
    assert.equal(result.roleId, "owner-role");
    assert.equal(result.roleSlug, "house_owner");
    assert.equal(result.employmentId, "employment-1");
    assert.equal(state.rpcCalls, 1);
    assert.equal(state.lastRpcName, "onboard_employee");
    assert.deepEqual(state.lastRpcParams, {
      p_house_id: "house-1",
      p_entity_id: "entity-1",
      p_role_id: "owner-role",
      p_role_slug: "house_owner",
    });
    assert.equal(state.upsertCalls, 0);
  });

  it("falls back to a direct upsert when the RPC is missing", async () => {
    const { supabase, state } = createSupabaseMock({
      roleRows: [
        { id: "owner-role", slug: "house_owner", scope: "HOUSE" },
      ],
      rpcError: { message: "function public.onboard_employee(uuid, uuid, uuid, text) does not exist" },
    });

    const result = await ensureCreatorEmployment(supabase, "house-2", "entity-2");
    assert.equal(result.roleId, "owner-role");
    assert.equal(result.roleSlug, "house_owner");
    assert.equal(result.employmentId, null);
    assert.equal(state.rpcCalls, 1);
    assert.equal(state.upsertCalls, 1);
  });

  it("propagates errors when the fallback upsert fails", async () => {
    const { supabase } = createSupabaseMock({
      roleRows: [
        { id: "owner-role", slug: "house_owner", scope: "HOUSE" },
      ],
      rpcError: { message: "function public.onboard_employee(uuid, uuid, uuid, text) does not exist" },
      upsertError: { message: "insert violated constraint" },
    });

    await assert.rejects(
      ensureCreatorEmployment(supabase, "house-3", "entity-3"),
      /insert violated constraint|Failed to ensure creator employment record/,
    );
  });
});
