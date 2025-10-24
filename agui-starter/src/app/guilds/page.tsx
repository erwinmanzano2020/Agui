import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function GuildsPage() {
  const l = await labels();

  let db: ReturnType<typeof getSupabase> | null = null;
  try {
    db = getSupabase();
  } catch (error) {
    console.error("Failed to initialize Supabase", error);
  }

  if (!db) {
    return <div className="text-sm text-muted-foreground">No DB connection.</div>;
  }

  const { data, error } = await db
    .from("guilds")
    .select("slug,name,guild_type")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load guilds", error);
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Unable to load {l.guild} data.
        </CardContent>
      </Card>
    );
  }

  let guilds = data ?? [];

  if (guilds.length === 0) {
    const compat = await db
      .from("orgs_as_guilds")
      .select("slug,name,guild_type")
      .order("name", { ascending: true });
    if (compat.error) {
      console.error("Failed to load compatible guilds", compat.error);
    } else {
      guilds = compat.data ?? [];
    }
  }

  if (guilds.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No {l.guild}s yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {guilds.map((guild) => (
        <Card key={guild.slug ?? guild.name}>
          <CardContent className="py-5">
            <div className="font-semibold">{guild.name}</div>
            {guild.guild_type && (
              <div className="mb-3 text-xs text-muted-foreground">{guild.guild_type}</div>
            )}
            {guild.slug ? (
              <Link className="text-sm underline" href={`/guild/${guild.slug}`}>
                Open
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">No slug configured.</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
