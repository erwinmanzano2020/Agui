import type { ReactNode } from "react";

import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";

type RequireFeatureProps = {
  feature: AppFeature;
  children: ReactNode;
  dest?: string;
};

export async function RequireFeature({ feature, children, dest }: RequireFeatureProps) {
  await requireFeatureAccess(feature, dest ? { dest } : undefined);
  return <>{children}</>;
}
