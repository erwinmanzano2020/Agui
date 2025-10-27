import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { RequireFeature } from "@/components/auth/RequireFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { isFeatureOn } from "@/lib/feature";
import PayrollPageClient from "./payroll-page-client";

export default async function PayrollPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return (
    <RequireFeature feature={AppFeature.PAYROLL}>
      <PayrollPageClient />
    </RequireFeature>
  );
}
