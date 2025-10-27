import type { ReactNode } from "react";

import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";

export default async function GuildsLayout({ children }: { children: ReactNode }) {
  await requireFeatureAccess(AppFeature.GUILDS);
  return <>{children}</>;
}
