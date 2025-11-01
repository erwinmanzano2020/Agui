// src/lib/auth/server.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "../supabase-server";

let clientPromise: Promise<SupabaseClient> | null = null;

export function getServerSupabase(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = createServerSupabaseClient();
  }
  return clientPromise;
}

export async function getServerSession() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user ? { user: data.user } : null;
}
