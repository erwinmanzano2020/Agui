import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import PayrollDtrTodayPageClient from "./page.client";

export default async function PayrollDtrTodayPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return <PayrollDtrTodayPageClient />;
}
