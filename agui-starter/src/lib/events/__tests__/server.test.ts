import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

describe("emitEvent", () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it("returns quietly when the emit_event RPC is missing", async () => {
    const cacheModule = await import("next/cache");
    const revalidateTagMock = mock.method(cacheModule, "revalidateTag", () => {});

    const supabase = {
      rpc: async () => ({
        data: null,
        error: { code: "PGRST202", message: "missing" },
      }),
    };

    const supabaseModule = await import("@/lib/supabase/server");
    mock.method(supabaseModule, "createServerSupabaseClient", async () => supabase as never);

    const authzModule = await import("@/lib/authz/server");
    mock.method(authzModule, "getMyEntityId", async () => "entity-1");

    const { emitEvent } = await import("@/lib/events/server");

    await emitEvent("tiles_missing", "info", {});

    assert.strictEqual(revalidateTagMock.mock.calls.length, 0);
  });

  it("emits events and revalidates when the RPC is available", async () => {
    const cacheModule = await import("next/cache");
    const revalidateTagMock = mock.method(cacheModule, "revalidateTag", () => {});

    const rpcCalls: Array<{ topic: string; payload: unknown }> = [];
    const supabase = {
      rpc: async (topic: string, payload: unknown) => {
        rpcCalls.push({ topic, payload });
        return { data: null, error: null } as const;
      },
    };

    const supabaseModule = await import("@/lib/supabase/server");
    mock.method(supabaseModule, "createServerSupabaseClient", async () => supabase as never);

    const authzModule = await import("@/lib/authz/server");
    mock.method(authzModule, "getMyEntityId", async () => "entity-1");

    const { emitEvent } = await import("@/lib/events/server");

    await emitEvent("audit", "info", { foo: "bar" });

    assert.strictEqual(rpcCalls.length, 1);
    assert.deepStrictEqual(rpcCalls[0], {
      topic: "emit_event",
      payload: {
        p_topic: "audit",
        p_kind: "info",
        p_payload: { foo: "bar" },
        p_created_by: "entity-1",
      },
    });
    assert.strictEqual(revalidateTagMock.mock.calls.length, 1);
    assert.strictEqual(revalidateTagMock.mock.calls[0]?.arguments?.[0], "audit");
  });
});
