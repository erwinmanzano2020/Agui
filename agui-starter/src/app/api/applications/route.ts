import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { ApplicationType } from "@/lib/roles/types";

export const dynamic = "force-dynamic";

async function getServerSupabase() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => jar.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          jar.set({ name, value, ...options });
        },
        remove: (name: string, options: CookieOptions) => {
          jar.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    },
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const rawType = typeof body.type === "string" ? (body.type.trim() as ApplicationType) : null;
  const type: ApplicationType | null = rawType && APPLICATION_TYPES.includes(rawType) ? rawType : null;
  const brandSlugRaw = typeof body.brandSlug === "string" ? body.brandSlug.trim() : "";

  if (!email || !type) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabase = await getServerSupabase();
  const { error } = await supabase.from("applications").insert({
    email,
    type,
    brand_slug: brandSlugRaw || null,
    status: "pending",
  } as never);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

const APPLICATION_TYPES: ApplicationType[] = ["customer", "employee", "owner", "admin", "gm"];
