// src/lib/identity/bootstrap.server.ts
import { createServerSupabase } from "@/lib/auth/server";
import { z } from "@/lib/z";

const Input = z.object({
  // Optional explicit phone; we always have email from session
  phone: z.string().optional(),
});

export type BootstrapInput = z.infer<typeof Input>;

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

  async function link(kind: "email" | "phone", value: string) {
    const resp = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/identifiers/link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, value }), // API infers current entity via RLS helper
    });
    // Best-effort; ignore 409 duplicates
    if (!resp.ok && resp.status !== 409) {
      // swallow but return note
      return await resp.json().catch(() => ({}));
    }
    return null;
  }

  if (email) await link("email", email);
  if (phone) await link("phone", phone);

  return { ok: true as const, entityId: user.id };
}
