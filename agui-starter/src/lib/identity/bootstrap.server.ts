// src/lib/identity/bootstrap.server.ts
import { createServerSupabase } from "@/lib/auth/server";
import { z } from "@/lib/z";
import { headers, cookies } from "next/headers";

const Input = z.object({
  // Optional explicit phone; we always have email from session
  phone: z.string().optional(),
});

export type BootstrapInput = {
  phone?: string;
};

export async function ensureEntityForCurrentUser(args?: BootstrapInput) {
  const parsedArgs = Input.parse(args ?? {});
  const supabase = await createServerSupabase();
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user) return { ok: false as const, reason: "no-session" };

  // 1) Ensure base entity exists (maps to auth.user.id)
  //   - DB migration already has PK/uniq on entities.id = auth.user.id
  const { error: upsertErr } = await supabase
    .from("entities" as never)
    .upsert(
      [{ id: user.id, display_name: user.email ?? user.phone ?? "Unnamed" }] as never,
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (upsertErr && upsertErr.code !== "23505") {
    return { ok: false as const, reason: "entity-upsert-failed", error: upsertErr.message };
  }

  // 2) Link known identifiers
  const email = user.email ?? null;
  const phone = parsedArgs.phone ?? (user.user_metadata?.phone_number as string | undefined) ?? null;

  async function absoluteUrl(path: string) {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "https";
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const base =
      process.env.NEXT_PUBLIC_BASE_URL && /^https?:\/\//i.test(process.env.NEXT_PUBLIC_BASE_URL)
        ? process.env.NEXT_PUBLIC_BASE_URL
        : host
        ? `${proto}://${host}`
        : "http://localhost:3000";
    return new URL(path, base).toString();
  }

  async function cookieHeaderString() {
    const list = (await cookies()).getAll();
    return list.map(({ name, value }) => `${name}=${value}`).join("; ");
  }

  async function link(kind: "email" | "phone", value: string) {
    try {
      const resp = await fetch(await absoluteUrl("/api/identifiers/link"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: await cookieHeaderString(),
        },
        body: JSON.stringify({ kind, value }),
      });
      if (!resp.ok && resp.status !== 409) {
        return { warned: true, status: resp.status };
      }
    } catch {
      return { warned: true };
    }
    return { warned: false };
  }

  if (email) await link("email", email);
  if (phone) await link("phone", phone);

  return { ok: true as const, entityId: user.id };
}
