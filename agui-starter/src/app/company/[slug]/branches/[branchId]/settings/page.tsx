import { notFound } from "next/navigation";

import SettingsWorkbench from "@/components/settings/SettingsWorkbench";
import { loadSnapshotsByCategory } from "@/lib/settings/loaders";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function loadHouse(slug: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("houses")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle<{ id: string; name: string | null; slug: string | null }>();
  if (error) {
    console.error("Failed to load house for branch settings", error);
    return null;
  }
  return data ?? null;
}

async function loadBranch(branchId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("branches")
    .select("id,name,house_id")
    .eq("id", branchId)
    .maybeSingle<{ id: string; name: string | null; house_id: string }>();
  if (error) {
    console.error("Failed to load branch for settings", error);
    return null;
  }
  return data ?? null;
}

export default async function BranchSettingsPage({
  params,
}: {
  params: { slug: string; branchId: string };
}) {
  const [house, branch] = await Promise.all([loadHouse(params.slug), loadBranch(params.branchId)]);
  if (!house || !branch || branch.house_id !== house.id) {
    notFound();
  }

  const [snapshots, globalSnapshots] = await Promise.all([
    loadSnapshotsByCategory({ businessId: house.id, branchId: branch.id }),
    loadSnapshotsByCategory(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Branch</p>
        <h1 className="text-3xl font-semibold text-foreground">{branch.name ?? branch.id}</h1>
        <p className="text-sm text-muted-foreground">
          These overrides apply only to this branch. Use Reset to fall back to the business defaults.
        </p>
      </div>
      <SettingsWorkbench
        scope="BRANCH"
        snapshots={snapshots}
        globalSnapshots={globalSnapshots}
        context={{ businessId: house.id, branchId: branch.id }}
      />
    </div>
  );
}
