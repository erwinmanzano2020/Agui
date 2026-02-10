import { NextResponse } from "next/server";

import { createSupabaseKioskRepo } from "@/lib/hr/kiosk/repository";
import { KioskAuthError, processKioskScan } from "@/lib/hr/kiosk/service";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

type ScanBody = {
  qrToken?: string;
  occurredAt?: string;
  clientId?: string;
};

export async function POST(request: Request) {
  const kioskToken = request.headers.get("x-kiosk-token")?.trim();
  if (!kioskToken) {
    return NextResponse.json({ error: "Missing x-kiosk-token header." }, { status: 401 });
  }

  let body: ScanBody;
  try {
    body = (await request.json()) as ScanBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.qrToken) {
    return NextResponse.json({ error: "qrToken is required." }, { status: 400 });
  }

  try {
    const supabase = createServiceSupabaseClient();
    const repo = createSupabaseKioskRepo(supabase);
    const result = await processKioskScan(repo, {
      kioskToken,
      qrToken: body.qrToken,
      occurredAt: body.occurredAt,
      clientId: body.clientId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof KioskAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed kiosk scan.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
