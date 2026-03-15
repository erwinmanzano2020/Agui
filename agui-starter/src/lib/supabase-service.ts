import type { Database } from "@/lib/db.types";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export function getServiceSupabase<Schema = Database>() {
  return createServiceSupabaseClient<Schema>();
}
