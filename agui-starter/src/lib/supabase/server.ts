import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import { createServerSupabase } from "@/lib/auth/server";

export async function createServerSupabaseClient<
  Schema = Database,
>(): Promise<SupabaseClient<Schema>> {
  const supabase = await createServerSupabase();
  return supabase as SupabaseClient<Schema>;
}

export type ServerSupabaseFactory = typeof createServerSupabaseClient;
