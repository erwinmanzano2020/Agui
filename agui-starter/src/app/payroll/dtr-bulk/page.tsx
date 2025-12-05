// agui-starter/src/app/payroll/dtr-bulk/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { ModuleOffMessage } from "@/components/ui/module-off-message";
import { RequireAnyFeature } from "@/components/auth/RequireAnyFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { isFeatureOn } from "@/lib/feature";
import DtrBulkClient from "./DtrBulkClient";

export default async function Page() {
  const enabled = await isFeatureOn("payroll");
  if (!enabled) {
    return <ModuleOffMessage moduleName="Payroll" />;
  }

  return (
    <RequireAnyFeature
      feature={[AppFeature.DTR_BULK, AppFeature.PAYROLL]}
      dest="/payroll/dtr-bulk"
    >
      <Suspense
        fallback={
          <div className="p-4 text-sm text-muted-foreground">Loading…</div>
        }
      >
        <DtrBulkClient />
      </Suspense>
    </RequireAnyFeature>
  );
}
