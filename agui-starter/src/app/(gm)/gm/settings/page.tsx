import SettingsWorkbench from "@/components/settings/SettingsWorkbench";
import { loadSnapshotsByCategory } from "@/lib/settings/loaders";

export default async function GMSettingsPage() {
  const snapshots = await loadSnapshotsByCategory();
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Game Master</p>
        <h1 className="text-3xl font-semibold text-foreground">Global Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the platform defaults for receipts, POS, and communications. Changes apply to every business unless overridden.
        </p>
      </div>
      <SettingsWorkbench scope="GM" snapshots={snapshots} globalSnapshots={snapshots} context={{}} />
    </div>
  );
}
