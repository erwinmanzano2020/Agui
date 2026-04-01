import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { requirePosAccess } from "@/lib/pos/access";

import { PosSessionClient } from "./session-client";

export const dynamic = "force-dynamic";

export default async function PosSessionPage({ params }: { params: { slug: string } }) {
  const dest = `/company/${params.slug}/pos/session`;
  const { supabase } = await requireAuth(dest);

  const { data: house } = await supabase.from("houses").select("id,slug").eq("slug", params.slug).maybeSingle();
  if (!house) {
    return notFound();
  }

  await requirePosAccess(supabase, house.id, { dest });
  const { data: defaultBranch } = await supabase
    .from("branches")
    .select("id")
    .eq("house_id", house.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  return <PosSessionClient slug={house.slug} defaultBranchId={defaultBranch?.id ?? null} />;
}
