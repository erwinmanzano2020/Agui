import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import ShiftsPageClient from "./page.client";

export default async function ShiftsPage() {
  const enabled = await isFeatureOn("shifts");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Shifts" />;
  }

  return <ShiftsPageClient />;
}
