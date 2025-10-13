import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import BulkPayslipPageClient from "./page.client";

export default async function BulkPayslipPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return <BulkPayslipPageClient />;
}
