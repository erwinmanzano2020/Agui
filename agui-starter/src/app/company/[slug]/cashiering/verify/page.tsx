import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { getSettingsSnapshot } from "@/lib/settings/server";

import VerifyDropClient from "./pageClient";

export const dynamic = "force-dynamic";

export default async function VerifyDropsPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/cashiering/verify`;
  const { supabase } = await requireAuth(nextPath);
  await requireFeatureAccess(AppFeature.POS, { dest: nextPath });

  const { data: house, error } = await supabase
    .from("houses")
    .select("id, name, slug")
    .eq("slug", params.slug)
    .maybeSingle<{ id: string; name: string | null; slug: string }>();

  if (error) {
    console.error("Failed to load house for verify drops", error);
  }

  if (!house) {
    return notFound();
  }

  const snapshot = await getSettingsSnapshot({
    category: "pos",
    businessId: house.id,
    branchId: house.id,
  });

  const overagePoolEnabled = snapshot["pos.cash.overage_pool.enabled"]?.value ?? true;
  const maxOffsetRatio = snapshot["pos.cash.overage_pool.max_offset_ratio"]?.value ?? 0.5;

  return (
    <VerifyDropClient
      branchId={house.id}
      branchName={house.name ?? ""}
      overagePoolEnabled={Boolean(overagePoolEnabled)}
      maxOffsetRatio={typeof maxOffsetRatio === "number" ? maxOffsetRatio : 0.5}
    />
  );
}
