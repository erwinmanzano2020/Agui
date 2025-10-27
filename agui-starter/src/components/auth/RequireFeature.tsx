import type { ReactNode } from "react";

import { ForbiddenState } from "@/components/auth/Forbidden";
import { can, type Feature } from "@/lib/authz/server";

type RequireFeatureProps = {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
};

export async function RequireFeature({ feature, children, fallback }: RequireFeatureProps) {
  const allowed = await can(feature);

  if (!allowed) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return <ForbiddenState />;
  }

  return <>{children}</>;
}
