import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { requireAuth } from "@/lib/auth/require-auth";
import { isFeatureOn } from "@/lib/feature";
import { redirectLegacyPayrollRoute } from "@/lib/hr/legacy-payroll-redirect";

export default async function LegacyPayrollRedirectPage() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  const { supabase } = await requireAuth("/payroll/payslip");
  return redirectLegacyPayrollRoute(supabase, "/hr/payslips");
}
