import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import PosClient from "../../pos/pos-client";
import { requirePosAccess } from "@/lib/pos/access";
import { loadWorkspaceSettings } from "@/lib/settings/workspace";

export const dynamic = "force-dynamic";

export default async function OperationsPosPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/operations/pos`;
  const { supabase } = await requireAuth(nextPath);

  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (houseError) {
    console.error("Failed to load house for POS", houseError);
  }

  if (!house) return notFound();

  await requirePosAccess(supabase, house.id, { dest: nextPath });

  const workspaceSettings = await loadWorkspaceSettings(house.id);

  return <PosClient companyId={house.id} companySlug={house.slug} labels={workspaceSettings.labels} />;
}
