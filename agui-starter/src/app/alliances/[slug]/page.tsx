import { notFound } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function AllianceDetail({
  params,
}: {
  params: { slug: string };
}) {
  const l = await labels();

  let db: ReturnType<typeof getSupabase> | null = null;
  try {
    db = getSupabase();
  } catch (error) {
    console.error("Failed to initialize Supabase", error);
  }

  if (!db) {
    return notFound();
  }

  const { data: alliance, error } = await db
    .from("alliances")
    .select("id,name,slug")
    .eq("slug", params.slug)
    .maybeSingle();

  if (error || !alliance) {
    console.error("Failed to load alliance", error);
    return notFound();
  }

  const { data: rel, error: relError } = await db
    .from("alliance_guilds")
    .select("guild_id")
    .eq("alliance_id", alliance.id);
  const guildCount = relError ? 0 : rel?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="text-xl font-semibold">{alliance.name}</div>
      <Card>
        <CardContent className="py-6">
          <div className="text-sm text-muted-foreground">/{alliance.slug}</div>
          <div className="mt-4">
            {l.guild} Count: <span className="font-medium">{guildCount}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
