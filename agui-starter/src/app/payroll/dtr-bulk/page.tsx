// agui-starter/src/app/payroll/dtr-bulk/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { isFeatureOn } from "@/lib/feature";
import DtrBulkClient from "./DtrBulkClient";

export default async function Page() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <DtrBulkClient />
    </Suspense>
  );
}
