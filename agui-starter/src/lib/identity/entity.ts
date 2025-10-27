import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getSupabase } from "@/lib/supabase";

export async function ensureEntityByEmail(
  email: string,
  opts?: { displayName?: string },
  svc?: SupabaseClient
) {
  const db = svc ?? getServiceSupabase();
  const found = await db
    .from("entity_identifiers")
    .select("entity_id")
    .eq("identifier_type", "EMAIL")
    .eq("identifier_value", email.toLowerCase())
    .maybeSingle();

  if (found.error) throw found.error;

  if (found.data?.entity_id) {
    const ent = await db.from("entities").select("id,display_name").eq("id", found.data.entity_id).maybeSingle();
    if (ent.error || !ent.data) {
      throw ent.error ?? new Error("Entity not found for identifier");
    }
    return ent.data;
  }

  const created = await db
    .from("entities")
    .insert({ display_name: opts?.displayName ?? email })
    .select("id,display_name")
    .single();

  if (created.error || !created.data) {
    throw created.error ?? new Error("Failed to create entity");
  }

  const link = await db.from("entity_identifiers").insert({
    entity_id: created.data.id,
    identifier_type: "EMAIL",
    identifier_value: email.toLowerCase(),
    is_primary: true,
  });

  if (link.error) throw link.error;

  return created.data;
}

async function getAuthedSupabase(): Promise<SupabaseClient | null> {
  if (typeof window === "undefined") {
    return await createServerSupabaseClient();
  }
  return getSupabase();
}

export async function isGM() {
  const db = await getAuthedSupabase();
  if (!db) return false;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();

  if (error) {
    console.warn("Failed to load Supabase user", error);
    return false;
  }

  const email = user?.email?.toLowerCase();
  if (!email) return false;

  const ent = await db
    .from("entity_identifiers")
    .select("entity_id")
    .eq("identifier_type", "EMAIL")
    .eq("identifier_value", email)
    .maybeSingle();

  if (ent.error) {
    console.warn("Failed to load entity identifier", ent.error);
    return false;
  }

  if (!ent.data?.entity_id) return false;

  const pr = await db
    .from("platform_roles")
    .select("roles")
    .eq("entity_id", ent.data.entity_id)
    .maybeSingle();

  if (pr.error) {
    console.warn("Failed to load platform roles", pr.error);
    return false;
  }

  return !!pr.data?.roles?.includes("game_master");
}

export async function requireGM() {
  const ok = await isGM();
  if (!ok) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
}
