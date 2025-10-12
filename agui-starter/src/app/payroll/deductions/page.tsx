import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import PayrollDeductionsPageClient from "./page.client";

export default async function PayrollDeductionsPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return <PayrollDeductionsPageClient />;
}
