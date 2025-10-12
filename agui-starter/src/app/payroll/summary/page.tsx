import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import PayrollSummaryPageClient from "./page.client";

export default async function PayrollSummaryPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return <PayrollSummaryPageClient />;
}
