import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getCurrentEntityId(): Promise<string | null> {
  const sb = await createServerSupabaseClient();
  const { data: userRes } = await sb.auth.getUser();
  const uid = userRes?.user?.id;
  if (!uid) return null;
  const { data } = await sb.from("accounts").select("entity_id").eq("user_id", uid).maybeSingle();
  return (data as { entity_id: string } | null)?.entity_id ?? null;
}
