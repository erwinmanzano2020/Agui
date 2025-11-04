import { NextResponse } from "next/server";
import { z } from "@/lib/z";
import { createServerSupabase } from "@/lib/auth/server";

const Params = z.object({ id: z.string().uuid() });

export async function POST(_req: Request, ctx: { params: { id: string } }) {
  const supabase = await createServerSupabase();
  const { id } = Params.parse(ctx.params);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("entity_applications" as never)
    .update({ status: "approved", decided_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, application: data });
}
