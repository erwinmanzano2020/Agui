import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase-service";
import { getSupabase } from "@/lib/supabase";

class ForbiddenError extends Error {
  status: number;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
    this.status = 403;
  }
}

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

async function getAuthedSupabase(): Promise<SupabaseClient> {
  if (typeof window === "undefined") {
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    return createServerSupabaseClient();
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error(
      "Supabase client not initialized. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}

export async function isGM(): Promise<boolean> {
  const db = await getAuthedSupabase();
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
    throw new ForbiddenError();
  }
}
