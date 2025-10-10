// agui-starter/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
} from "./env";

// We validate on the server in env.ts, so assert non-null here.
export const supabase = createClient(
  NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
