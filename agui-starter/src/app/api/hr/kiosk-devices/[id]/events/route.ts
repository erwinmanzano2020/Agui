import { NextRequest } from "next/server";

import { jsonError, jsonOk } from "@/lib/api/http";
import { KioskAdminError, listKioskDeviceEvents } from "@/lib/hr/kiosk/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const QuerySchema = z.object({
  houseId: z.string().uuid(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return jsonError(401, "Not authenticated");

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    houseId: url.searchParams.get("houseId"),
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) return jsonError(400, "Invalid query", { issues: parsed.error.issues });

  const { id } = await params;
  try {
    const events = await listKioskDeviceEvents(supabase, {
      houseId: parsed.data.houseId,
      deviceId: id,
      limit: parsed.data.limit,
    });
    return jsonOk({ events });
  } catch (error) {
    if (error instanceof KioskAdminError) return jsonError(error.status, error.message);
    return jsonError(500, error instanceof Error ? error.message : "Internal server error");
  }
}
