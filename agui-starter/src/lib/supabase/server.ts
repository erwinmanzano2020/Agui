import "server-only";

import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";
import { createServerSupabase, type CreateServerSupabaseOptions } from "@/lib/auth/server";

export async function createServerSupabaseClient<
  Schema = Database,
>(options: CreateServerSupabaseOptions = {}): Promise<SupabaseClient<Schema>> {
  const supabase = await createServerSupabase(options);
  return supabase as SupabaseClient<Schema>;
}

export type ServerSupabaseFactory = typeof createServerSupabaseClient;
