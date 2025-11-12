export const dynamic = "force-dynamic";

import CentralizedSettingsWorkspace from "@/components/settings/CentralizedSettingsWorkspace";
import { SETTINGS_CATALOG } from "@/lib/settings/catalog";
import { getSettingsSnapshot } from "@/lib/settings/server";
import type { SettingScope } from "@/lib/settings/types";

function collectCategories() {
  return Array.from(new Set(SETTINGS_CATALOG.map((entry) => entry.category)));
}

async function buildSnapshotByCategory() {
  const categories = collectCategories();
  const records: Record<string, Record<string, { value: unknown; source: SettingScope }>> = {};
  for (const category of categories) {
    const snapshot = await getSettingsSnapshot({ category });
    records[category] = snapshot as Record<string, { value: unknown; source: SettingScope }>;
  }
  return records;
}

export default async function GMSettingsPage() {
  const categories = collectCategories();
  const gmSnapshots = await buildSnapshotByCategory();
  return (
    <main className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Global Settings</h1>
        <p className="text-sm text-neutral-500">
          Configure defaults that cascade to businesses and branches.
        </p>
      </header>
      <CentralizedSettingsWorkspace
        scope="GM"
        categories={categories}
        effectiveSnapshots={gmSnapshots}
        gmSnapshots={gmSnapshots}
      />
    </main>
  );
}
