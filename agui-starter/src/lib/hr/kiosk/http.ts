import { NextResponse } from "next/server";

import { createSupabaseKioskRepo } from "@/lib/hr/kiosk/repository";
import {
  KioskAuthError,
  KioskConflictError,
  processKioskScan,
  processKioskSync,
} from "@/lib/hr/kiosk/service";
import { KioskRequestAuthError, readBearerKioskToken, requireKioskDevice } from "@/lib/hr/kiosk/request-auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

function kioskErrorResponse(error: unknown) {
  if (error instanceof KioskRequestAuthError) {
    return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
  }
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Kiosk request failed." },
    { status: 500 },
  );
}

export async function handleKioskPing(request: Request) {
  try {
    const token = readBearerKioskToken(request);
    const supabase = createServiceSupabaseClient();
    const auth = await requireKioskDevice(supabase, token);

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("name")
      .eq("id", auth.branchId)
      .maybeSingle<{ name: string | null }>();

    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("hr_kiosk_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", auth.deviceId)
      .eq("house_id", auth.houseId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      device: {
        id: auth.deviceId,
        name: auth.deviceName,
        branch_id: auth.branchId,
        branch_name: branch?.name ?? null,
      },
      house_id: auth.houseId,
    });
  } catch (error) {
    return kioskErrorResponse(error);
  }
}


function toIsoTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function serializeScanResultTime<T extends { time: string }>(result: T): T {
  return { ...result, time: toIsoTimestamp(result.time) };
}


type KioskScanDebugTiming = {
  serverTotalMs: number;
  steps: {
    authMs: number;
    tokenResolveMs: number;
    employeeLookupMs: number;
    actionDecisionMs: number;
    writeMs: number;
    responseBuildMs: number;
  };
};

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function roundMs(value: number): number {
  return Math.max(0, Math.round(value));
}

type ScanBody = {
  qrToken?: string;
  occurredAt?: string;
  clientId?: string;
};

export async function handleKioskScan(request: Request) {
  const requestStartedAt = nowMs();
  const requestUrl = new URL(request.url);
  const debugRequested = process.env.NEXT_PUBLIC_HR_KIOSK_SCAN_DEBUG === "1"
    || requestUrl.searchParams.get("debug") === "1"
    || request.headers.get("x-hr-kiosk-debug") === "1";

  let body: ScanBody;
  try {
    body = (await request.json()) as ScanBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.qrToken) {
    return NextResponse.json({ error: "qrToken is required." }, { status: 400 });
  }

  let authMs = 0;
  let tokenResolveMs = 0;
  let employeeLookupMs = 0;
  let actionDecisionMs = 0;
  let writeMs = 0;

  const buildTiming = (responseBuildStartedAt: number): KioskScanDebugTiming => ({
    serverTotalMs: roundMs(nowMs() - requestStartedAt),
    steps: {
      authMs: roundMs(authMs),
      tokenResolveMs: roundMs(tokenResolveMs),
      employeeLookupMs: roundMs(employeeLookupMs),
      actionDecisionMs: roundMs(actionDecisionMs),
      writeMs: roundMs(writeMs),
      responseBuildMs: roundMs(nowMs() - responseBuildStartedAt),
    },
  });

  try {
    let supabase: ReturnType<typeof createServiceSupabaseClient> | null = null;
    let auth: Awaited<ReturnType<typeof requireKioskDevice>>;
    const authStartedAt = nowMs();
    try {
      const token = readBearerKioskToken(request);
      supabase = createServiceSupabaseClient();
      auth = await requireKioskDevice(supabase, token);
    } finally {
      authMs = nowMs() - authStartedAt;
    }

    const repo = createSupabaseKioskRepo(supabase!);

    const result = await processKioskScan(repo, {
      kioskToken: auth.token,
      qrToken: body.qrToken,
      occurredAt: body.occurredAt,
      clientId: body.clientId,
      timingHooks: {
        onTokenResolved(durationMs) {
          tokenResolveMs = durationMs;
        },
        onEmployeeLookupComplete(durationMs) {
          employeeLookupMs = durationMs;
        },
        onActionDecisionComplete(durationMs) {
          actionDecisionMs = durationMs;
        },
        onWriteComplete(durationMs) {
          writeMs = durationMs;
        },
      },
    });

    const responseBuildStartedAt = nowMs();
    const payload: typeof result & { debugTiming?: KioskScanDebugTiming } = serializeScanResultTime(result);

    if (debugRequested) {
      payload.debugTiming = buildTiming(responseBuildStartedAt);
      console.log("[kiosk-scan-debug] server-timing", {
        clientId: body.clientId ?? null,
        action: payload.action,
        debugTiming: payload.debugTiming,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    const responseBuildStartedAt = nowMs();
    const debugTiming = debugRequested ? buildTiming(responseBuildStartedAt) : undefined;

    if (debugRequested) {
      console.log("[kiosk-scan-debug] server-timing", {
        clientId: body.clientId ?? null,
        error: error instanceof Error ? error.message : String(error),
        debugTiming,
      });
    }

    const basePayload: Record<string, unknown> = debugTiming ? { debugTiming } : {};

    if (error instanceof KioskRequestAuthError) {
      return NextResponse.json({ ...basePayload, error: error.message, reason: error.reason }, { status: error.status });
    }
    if (error instanceof KioskAuthError) {
      return NextResponse.json({ ...basePayload, error: error.message }, { status: 401 });
    }
    if (error instanceof KioskConflictError) {
      return NextResponse.json({ ...basePayload, error: error.message, ...error.details }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed kiosk scan.";
    return NextResponse.json({ ...basePayload, error: message }, { status: 400 });
  }
}

type SyncBody = {
  events?: Array<{ qrToken?: string; occurredAt?: string; clientEventId?: string }>;
};

export async function handleKioskSync(request: Request) {
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

  try {
    const token = readBearerKioskToken(request);
    const supabase = createServiceSupabaseClient();
    const auth = await requireKioskDevice(supabase, token);

    if (events.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const repo = createSupabaseKioskRepo(supabase);
    const result = await processKioskSync(repo, { kioskToken: auth.token, events });
    return NextResponse.json({
      results: result.results.map((entry) => (
        entry.status === "processed" ? { ...entry, result: serializeScanResultTime(entry.result) } : entry
      )),
    });
  } catch (error) {
    if (error instanceof KioskRequestAuthError) {
      return NextResponse.json({ error: error.message, reason: error.reason }, { status: error.status });
    }
    if (error instanceof KioskAuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Failed kiosk sync.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

type VerifyBody = { slug?: string };

export async function handleKioskVerify(request: Request) {
  let body: VerifyBody | null = null;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    body = null;
  }

  try {
    const token = readBearerKioskToken(request);
    const supabase = createServiceSupabaseClient();
    const auth = await requireKioskDevice(supabase, token, {
      expectedSlug: body?.slug?.trim() || null,
    });

    const { data: house, error: houseError } = await supabase
      .from("houses")
      .select("slug")
      .eq("id", auth.houseId)
      .maybeSingle<{ slug: string | null }>();
    if (houseError) {
      return NextResponse.json({ error: houseError.message }, { status: 500 });
    }

    const { data: branch, error: branchError } = await supabase
      .from("branches")
      .select("name")
      .eq("id", auth.branchId)
      .maybeSingle<{ name: string | null }>();
    if (branchError) {
      return NextResponse.json({ error: branchError.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      device: {
        id: auth.deviceId,
        name: auth.deviceName,
        branch_id: auth.branchId,
        branch_name: branch?.name ?? null,
      },
      house_id: auth.houseId,
      slug: house?.slug ?? null,
    });
  } catch (error) {
    return kioskErrorResponse(error);
  }
}
