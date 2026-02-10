import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { KioskAdminError, setKioskDeviceEnabled } from "@/lib/hr/kiosk/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const BodySchema = z.object({ houseId: z.string().uuid() });
const ParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return jsonError(401, "Not authenticated");

  const entityId = await resolveEntityIdForUser(userData.user, supabase);
  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) return jsonError(400, "Invalid device id");

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(400, "Invalid payload", { issues: parsed.error.issues });

  try {
    await setKioskDeviceEnabled(supabase, {
      houseId: parsed.data.houseId,
      deviceId: parsedParams.data.id,
      enabled: false,
      actorEntityId: entityId,
    });
    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof KioskAdminError) return jsonError(error.status, error.message);
    return jsonError(500, error instanceof Error ? error.message : "Internal server error");
  }
}
