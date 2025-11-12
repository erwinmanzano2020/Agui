import CentralizedSettingsWorkspace from "@/components/settings/CentralizedSettingsWorkspace";
import { SETTINGS_CATALOG } from "@/lib/settings/catalog";
import { getSettingsSnapshot } from "@/lib/settings/server";
import type { SettingScope } from "@/lib/settings/types";

type PageProps = {
  params: { slug: string; branchId: string };
};

function collectCategories() {
  return Array.from(new Set(SETTINGS_CATALOG.map((entry) => entry.category)));
}

async function buildSnapshots(businessId: string, branchId: string) {
  const categories = collectCategories();
  const effective: Record<string, Record<string, { value: unknown; source: SettingScope }>> = {};
  const gmSnapshots: Record<string, Record<string, { value: unknown; source: SettingScope }>> = {};

  for (const category of categories) {
    effective[category] = (await getSettingsSnapshot({
      category,
      businessId,
      branchId,
    })) as Record<string, { value: unknown; source: SettingScope }>;
    gmSnapshots[category] = (await getSettingsSnapshot({
      category,
      businessId,
    })) as Record<string, { value: unknown; source: SettingScope }>;
  }

  return { effective, gmSnapshots };
}

export default async function BranchSettingsPage({ params }: PageProps) {
  const businessId = params.slug;
  const branchId = params.branchId;
  const categories = collectCategories();
  const { effective, gmSnapshots } = await buildSnapshots(businessId, branchId);

  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Branch Settings</h1>
        <p className="text-sm text-neutral-500">
          Fine-tune overrides for branch {branchId} of business {businessId}.
        </p>
      </header>
      <CentralizedSettingsWorkspace
        scope="BRANCH"
        categories={categories}
        effectiveSnapshots={effective}
        gmSnapshots={gmSnapshots}
        businessId={businessId}
        branchId={branchId}
      />
    </main>
  );
}
