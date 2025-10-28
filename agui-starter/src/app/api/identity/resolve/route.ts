import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateEntityByIdentifier, type IdentifierKind } from "@/lib/auth/entity";
import { getMyRoles } from "@/lib/authz/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const IDENTIFIER_KIND_VALUES = ["email", "phone"] as const;
const identifierKindSchema = z.enum(IDENTIFIER_KIND_VALUES);
const resolveIdentitySchema = z.object({
  kind: identifierKindSchema,
  value: z.string().min(1, "value required"),
});

// Exercise the schema at module evaluation so import regressions fail fast.
resolveIdentitySchema.parse({ kind: "email", value: "self-test" });

export async function POST(req: Request) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    console.error("Failed to initialize Supabase for identity resolver", error);
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  if (!isGM) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = resolveIdentitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { kind, value } = parsed.data as { kind: IdentifierKind; value: string };

  try {
    const ent = await getOrCreateEntityByIdentifier(kind, value);
    return NextResponse.json({ entity: ent });
  } catch (error) {
    console.error("Failed to resolve identity", error);
    return NextResponse.json({ error: "Failed to resolve identity" }, { status: 500 });
  }
}
