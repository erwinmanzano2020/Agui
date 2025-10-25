import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import PosClient from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/pos`;
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

  return <PosClient companyId={house.id} companySlug={house.slug} />;
}
