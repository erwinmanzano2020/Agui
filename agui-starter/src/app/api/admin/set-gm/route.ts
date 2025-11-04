import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

// --- Input schema ---
const Body = z.object({
  entityId: z.string().uuid(),
  isGm: z.boolean(),
});

// --- Minimal RPC surface typed without `any` ---
type RpcError = { message: string } | null;
type RpcResult<T = unknown> = Promise<{ data: T; error: RpcError }>;
type RpcArgs = Record<string, unknown>;

interface RpcCapable {
  rpc<T = unknown>(fn: string, args?: RpcArgs): RpcResult<T>;
  auth: {
    getUser(): Promise<{
      data: { user: { id: string; email?: string | null } | null } | null;
      error: { message: string } | null;
    }>;
  };
}

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    const json = raw ? JSON.parse(raw) : {};
    const { entityId, isGm } = Body.parse(json);

    const supabase = (await createServerSupabase()) as unknown as RpcCapable;

    // must be signed in
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (!userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // confirm current entity is GM
    const { data: gmFlag, error: gmErr } = await supabase.rpc<boolean>(
      "current_entity_is_gm",
    );
    if (gmErr) return NextResponse.json({ error: gmErr.message }, { status: 500 });
    if (gmFlag !== true) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // toggle target entity's GM flag
    const { error } = await supabase.rpc("admin_set_gm", {
      p_entity_id: entityId,
      p_is_gm: isGm,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
