import type { ReactNode } from "react";

import { requireAnyFeatureAccess } from "@/lib/auth/feature-guard";
import { type FeatureInput } from "@/lib/auth/permissions";

type RequireAnyFeatureProps = {
  feature: FeatureInput;
  children: ReactNode;
  dest?: string;
};

export async function RequireAnyFeature({ feature, children, dest }: RequireAnyFeatureProps) {
  await requireAnyFeatureAccess(feature, dest ? { dest } : undefined);
  return <>{children}</>;
}
