import { SETTING_CATEGORIES, type SettingCategory } from "@/lib/settings/catalog";
import { getSettingsSnapshot } from "@/lib/settings/server";
import type { SettingsSnapshot } from "@/lib/settings/types";

type SnapshotOptions = {
  businessId?: string | null;
  branchId?: string | null;
};

export async function loadSnapshotsByCategory(options?: SnapshotOptions) {
  const entries = await Promise.all(
    SETTING_CATEGORIES.map(async (category) => {
      const snapshot = await getSettingsSnapshot({ category, businessId: options?.businessId, branchId: options?.branchId });
      return [category, snapshot] as [SettingCategory, SettingsSnapshot];
    }),
  );
  return Object.fromEntries(entries) as Record<SettingCategory, SettingsSnapshot>;
}
