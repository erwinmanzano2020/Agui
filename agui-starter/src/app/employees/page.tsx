import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import { loadUiTerms } from "@/lib/ui-terms";
import EmployeesPageClient from "./page.client";

export default async function EmployeesPage() {
  const [enabled, terms] = await Promise.all([isFeatureOn("employees"), loadUiTerms()]);
  if (!enabled) {
    return <ModuleOffMessage moduleName={terms.team} />;
  }

  return <EmployeesPageClient />;
}
