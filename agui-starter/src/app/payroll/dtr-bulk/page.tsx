// agui-starter/src/app/payroll/dtr-bulk/page.tsx
export const dynamic = "force-dynamic";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Load the client component only on the client
const DtrBulkClient = dynamic(() => import("./DtrBulkClient"), { ssr: false });

export default function Page() {
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
