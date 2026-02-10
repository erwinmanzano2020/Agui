import { NextResponse } from "next/server";

import { createSupabaseKioskRepo } from "@/lib/hr/kiosk/repository";
import { KioskAuthError, processKioskSync } from "@/lib/hr/kiosk/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type SyncBody = {
  events?: Array<{ qrToken?: string; occurredAt?: string; clientEventId?: string }>;
};

export async function POST(request: Request) {
  const kioskToken = request.headers.get("x-kiosk-token")?.trim();
  if (!kioskToken) {
    return NextResponse.json({ error: "Missing x-kiosk-token header." }, { status: 401 });
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const events = (body.events ?? []).filter((event) => event.qrToken && event.clientEventId) as Array<{
    qrToken: string;
    occurredAt?: string;
    clientEventId: string;
  }>;

  if (events.length === 0) {
    return NextResponse.json({ results: [] });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const repo = createSupabaseKioskRepo(supabase);
    const result = await processKioskSync(repo, { kioskToken, events });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KioskAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed kiosk sync.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
