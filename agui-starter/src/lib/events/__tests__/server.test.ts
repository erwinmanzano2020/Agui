import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

describe("emitEvent", () => {
  afterEach(async () => {
    mock.restoreAll();
    const { __resetRevalidateTag } = await import("../revalidate");
    const { __resetEventDeps } = await import("../server");
    __resetRevalidateTag();
    await __resetEventDeps();
  });

  it("returns quietly when the emit_event RPC is missing", async () => {
    const revalidateModule = await import("../revalidate");
    const revalidateTagMock = mock.fn();
    revalidateModule.__setRevalidateTag(revalidateTagMock);

    const supabase = {
      rpc: async () => ({
        data: null,
        error: { code: "PGRST202", message: "missing" },
      }),
    };

    const { emitEvent, __setEventDeps } = await import("../server");
    await __setEventDeps({
      createClient: async () => supabase as never,
      getEntityId: async () => "entity-1",
    });

    await emitEvent("tiles_missing", "info", {});

    assert.strictEqual(revalidateTagMock.mock.calls.length, 0);
  });

  it("emits events and revalidates when the RPC is available", async () => {
    const revalidateModule = await import("../revalidate");
    const revalidateTagMock = mock.fn();
    revalidateModule.__setRevalidateTag(revalidateTagMock);

    const rpcCalls: Array<{ topic: string; payload: unknown }> = [];
    const supabase = {
      rpc: async (topic: string, payload: unknown) => {
        rpcCalls.push({ topic, payload });
        return { data: null, error: null } as const;
      },
    };

    const { emitEvent, __setEventDeps } = await import("../server");
    await __setEventDeps({
      createClient: async () => supabase as never,
      getEntityId: async () => "entity-1",
    });

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
