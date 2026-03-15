import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import ScanAdopt from "./scan-adopt";

export const dynamic = "force-dynamic";

export default async function InventoryScanPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/inventory/scan`;
  const { supabase } = await requireAuth(nextPath);
  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (houseError) {
    console.error("Failed to load house for inventory scan", houseError);
  }

  if (!house) return notFound();

  return <ScanAdopt companyId={house.id} />;
}
