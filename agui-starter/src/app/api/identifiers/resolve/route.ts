import { NextResponse } from "next/server";

import type { IdentityDatabase } from "@/lib/db.types";
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
  }),
  entityKind: z.enum(["person", "business", "gm"]).optional(),
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

  const supabase = getServiceSupabase<IdentityDatabase>();
  const store = createSupabaseIdentifierResolverStore(supabase);

  try {
    const result = await resolveIdentifier(store, parsed.data.identifier, {
      entityKind: parsed.data.entityKind ?? undefined,
      profile: parsed.data.profile ?? null,
      verification: parsed.data.verification ?? null,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      entity: result.entity,
      entitlements: result.entitlements,
      identifier: result.identifier,
    });
  } catch (error) {
    console.error("identifier resolve failed", error);
    const message = error instanceof Error ? error.message : "resolver error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
