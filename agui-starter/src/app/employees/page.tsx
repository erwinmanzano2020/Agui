import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import EmployeesPageClient from "./page.client";

export default async function EmployeesPage() {
  const enabled = await isFeatureOn("employees");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Employees" />;
  }

  return <EmployeesPageClient />;
}
