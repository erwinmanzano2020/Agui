import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";

import PosClient from "../../pos/pos-client";

export const dynamic = "force-dynamic";

export default async function OperationsPosPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/operations/pos`;
  const { supabase } = await requireAuth(nextPath);
  await requireFeatureAccess(AppFeature.POS, { dest: nextPath });

  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (houseError) {
    console.error("Failed to load house for POS", houseError);
  }

  if (!house) return notFound();

  return <PosClient companyId={house.id} companySlug={house.slug} />;
}
