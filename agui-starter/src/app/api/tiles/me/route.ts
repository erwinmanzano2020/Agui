import { NextResponse } from "next/server";

import { loadTilesForCurrentUser } from "@/lib/tiles/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const payload = await loadTilesForCurrentUser();
    const debug = new URL(request.url).searchParams.get("debug") === "1";
    if (!debug) {
      return NextResponse.json(payload);
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn("Failed to resolve user for tiles debug payload", error);
    }
    const userId = data?.user?.id ?? null;
    const tags = userId ? [`tiles:user:${userId}`] : [];
    return NextResponse.json({ ...payload, _debug: { tags } });
  } catch (error) {
    console.error("Failed to compute tiles", error);
    return NextResponse.json({ error: "Failed to compute tiles" }, { status: 500 });
  }
}
