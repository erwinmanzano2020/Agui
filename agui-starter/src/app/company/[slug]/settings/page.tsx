import { notFound } from "next/navigation";

import SettingsWorkbench from "@/components/settings/SettingsWorkbench";
import { loadSnapshotsByCategory } from "@/lib/settings/loaders";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function loadBusinessBySlug(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string | null; slug: string | null }>();

  if (error) {
    console.error("Failed to load business for settings", error);
    return null;
  }

  return data ?? null;
}

export default async function CompanySettingsPage({ params }: { params: { slug: string } }) {
  const business = await loadBusinessBySlug(params.slug);
  if (!business) {
    notFound();
  }

  const [snapshots, globalSnapshots] = await Promise.all([
    loadSnapshotsByCategory({ businessId: business.id }),
    loadSnapshotsByCategory(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Business</p>
        <h1 className="text-3xl font-semibold text-foreground">{business.name ?? business.slug ?? "Settings"}</h1>
        <p className="text-sm text-muted-foreground">
          Overrides here affect every branch unless fine-tuned in a specific branch settings page.
        </p>
      </div>
      <SettingsWorkbench
        scope="BUSINESS"
        snapshots={snapshots}
        globalSnapshots={globalSnapshots}
        context={{ businessId: business.id }}
      />
    </div>
  );
}
