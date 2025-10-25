import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import PosClient from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage({ params }: { params: { slug: string } }) {
  const db = getSupabase();
  if (!db) return notFound();

  const { data: house } = await db
    .from("houses")
    .select("id,slug,name")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!house) return notFound();

  return <PosClient companyId={house.id} companySlug={house.slug} />;
}
