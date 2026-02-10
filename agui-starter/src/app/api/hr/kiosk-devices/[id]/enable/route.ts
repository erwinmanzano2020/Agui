import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { KioskAdminError, setKioskDeviceEnabled } from "@/lib/hr/kiosk/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const BodySchema = z.object({ houseId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return jsonError(401, "Not authenticated");

  const { id } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Invalid payload", { issues: parsed.error.issues });

  try {
    await setKioskDeviceEnabled(supabase, {
      houseId: parsed.data.houseId,
      deviceId: id,
      enabled: true,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof KioskAdminError) return jsonError(error.status, error.message);
    return jsonError(500, error instanceof Error ? error.message : "Internal server error");
  }
}
