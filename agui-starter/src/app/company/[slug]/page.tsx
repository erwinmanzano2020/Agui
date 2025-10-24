import { getSupabase } from "@/lib/supabase";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompanyDetail({ params }: { params: { slug: string } }) {
  const db = getSupabase();
  if (!db) return notFound();
  const { data: house } = await db
    .from("houses")
    .select("id,slug,name,house_type,guild_id")
    .eq("slug", params.slug)
    .maybeSingle();
  if (!house) return notFound();

  return (
    <div className="space-y-2">
      <div className="text-xl font-semibold">{house.name}</div>
      <div className="text-xs text-muted-foreground">/{house.slug}</div>
      <div className="text-sm">
        Type: <span className="font-medium">{house.house_type}</span>
      </div>
    </div>
  );
}
