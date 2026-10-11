import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/db.types";

export async function redirectLegacyPayrollRoute(
  supabase: SupabaseClient<Database>,
  destinationSuffix: string,
): Promise<never> {
  const { data, error } = await supabase
    .from("houses")
    .select("slug")
    .order("created_at", { ascending: true })
    .limit(2);

  if (!error && data?.length === 1) {
    const slug = (data[0] as { slug?: string | null }).slug?.trim();
    if (slug) {
      redirect(`/company/${encodeURIComponent(slug)}${destinationSuffix}`);
    }
  }

  redirect("/me");
}
