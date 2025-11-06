import { NextResponse } from "next/server";

import type { Database } from "@/lib/db.types";
import {
  createSupabaseIdentifierResolverStore,
  resolveIdentifier,
} from "@/lib/identity/identifier-resolver";
import { getServiceSupabase } from "@/lib/supabase-service";
import { z } from "@/lib/z";

const schema = z.object({
  identifier: z.object({
    kind: z.enum(["email", "phone", "qr", "gov_id"]),
    value: z.string().min(1, "value is required"),
    meta: z.record(z.unknown()).optional(),
  }),
  displayName: z.string().optional(),
  profile: z.record(z.unknown()).optional(),
  verification: z
    .object({
      verified: z.boolean().optional(),
      verifiedAt: z.string().optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase<Database>();
  const store = createSupabaseIdentifierResolverStore(supabase);

  try {
    const result = await resolveIdentifier(store, parsed.data.identifier, {
      displayName: parsed.data.displayName ?? null,
      profile: parsed.data.profile ?? null,
      verification: parsed.data.verification ?? null,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      entity: result.entity,
      entitlements: result.entitlements,
      identifier: {
        id: result.identifier.id,
        kind: result.identifier.kind,
        issuer: result.identifier.issuer,
        value: result.identifier.value_norm,
        meta: result.identifier.meta,
        verified_at: result.identifier.verified_at,
        created_at: result.identifier.created_at,
        updated_at: result.identifier.updated_at,
      },
    });
  } catch (error) {
    console.error("identifier resolve failed", error);
    const message = error instanceof Error ? error.message : "resolver error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
