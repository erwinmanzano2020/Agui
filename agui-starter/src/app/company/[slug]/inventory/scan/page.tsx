import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ScanAdopt from "./scan-adopt";

export const dynamic = "force-dynamic";

export default async function InventoryScanPage({ params }: { params: { slug: string } }) {
  const db = getSupabase(); if (!db) return notFound();
  const { data: house } = await db.from("houses").select("id,slug,name").eq("slug", params.slug).maybeSingle();
  if (!house) return notFound();

  return <ScanAdopt companyId={house.id} />;
}
