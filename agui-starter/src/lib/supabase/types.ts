import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

export type AnySupabaseClient = SupabaseClient<Database>;
