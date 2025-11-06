import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

export function getServiceSupabase<Schema = Database>() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Schema>(url, key, { auth: { persistSession: false } });
}
