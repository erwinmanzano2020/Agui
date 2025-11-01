// src/lib/auth/server.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "../supabase-server";

export function getServerSupabase(): Promise<SupabaseClient> {
  return createServerSupabaseClient();
}

export async function getServerSession() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ? { user: data.user } : null;
}
