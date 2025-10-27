// agui-starter/src/app/payroll/dtr-bulk/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { RequireFeature } from "@/components/auth/RequireFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { isFeatureOn } from "@/lib/feature";
import DtrBulkClient from "./DtrBulkClient";

export default async function Page() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return (
    <RequireFeature feature={AppFeature.DTR_BULK}>
      <Suspense
        fallback={
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        }
      >
        <DtrBulkClient />
      </Suspense>
    </RequireFeature>
  );
}
