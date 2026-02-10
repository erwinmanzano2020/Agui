import { NextResponse } from "next/server";

import { hashKioskToken } from "@/lib/hr/kiosk/device-auth";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const kioskToken = request.headers.get("x-kiosk-token")?.trim();
  if (!kioskToken) {
    return NextResponse.json({ error: "Missing x-kiosk-token header." }, { status: 401 });
  }

  const tokenHash = hashKioskToken(kioskToken);

  try {
    const supabase = createServiceSupabaseClient();
    const { data: device, error } = await supabase
      .from("hr_kiosk_devices")
      .select("id, house_id, branch_id, name, is_active, disabled_at, branches(name)")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!device) {
      return NextResponse.json({ error: "Invalid kiosk token" }, { status: 401 });
    }

    if (!device.is_active || device.disabled_at) {
      return NextResponse.json(
        { error: "Device disabled. Contact HR.", reason: "device_disabled" },
        { status: 403 },
      );
    }

    const { error: updateError } = await supabase
      .from("hr_kiosk_devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device.id)
      .eq("house_id", device.house_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const branchName =
      Array.isArray(device.branches) && device.branches[0] && typeof device.branches[0] === "object"
        ? ((device.branches[0] as { name?: string }).name ?? null)
        : null;

    return NextResponse.json({
      ok: true,
      device: {
        id: device.id,
        name: device.name,
        branch_id: device.branch_id,
        branch_name: branchName,
        disabled_at: device.disabled_at,
      },
      house_id: device.house_id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify kiosk token." },
      { status: 500 },
    );
  }
}
