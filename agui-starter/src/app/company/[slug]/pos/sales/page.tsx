import { notFound } from "next/navigation";

import PosSalesScreen from "./PosSalesScreen";
import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";
import { loadWorkspaceSettings } from "@/lib/settings/workspace";

export const dynamic = "force-dynamic";

export default async function PosSalesPage({ params }: { params: { slug: string } }) {
  const dest = `/company/${params.slug}/pos/sales`;
  const { supabase } = await requireAuth(dest);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!house) {
    return notFound();
  }

  await requirePosAccess(supabase, house.id, { dest });
  const workspaceSettings = await loadWorkspaceSettings(house.id);

  return <PosSalesScreen slug={house.slug} labels={workspaceSettings.labels} houseName={house.name} />;
}
