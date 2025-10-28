import { NextResponse } from "next/server";
import { z } from "zod";

import { getOrCreateEntityByIdentifier } from "@/lib/auth/entity";

const resolveIdentitySchema = z.object({
  kind: z.enum(["email", "phone"]),
  value: z.string().min(1, "value required"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = resolveIdentitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "kind and value required",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { kind, value } = parsed.data;
  const ent = await getOrCreateEntityByIdentifier(kind, value);
  return NextResponse.json({ entity: ent });
}
