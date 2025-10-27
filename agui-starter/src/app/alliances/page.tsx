import Link from "next/link";

import { RequireFeature } from "@/components/auth/RequireFeature";
import { AppFeature } from "@/lib/auth/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

async function AlliancesContent() {
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
    .from("alliances")
    .select("slug,name")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load alliances", error);
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Unable to load {l.alliance} data.
        </CardContent>
      </Card>
    );
  }

  const alliances = data ?? [];

  if (alliances.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No {l.alliance}s yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {alliances.map((alliance) => (
        <Card key={alliance.slug ?? alliance.name}>
          <CardContent className="py-5">
            <div className="font-semibold">{alliance.name}</div>
            {alliance.slug && (
              <div className="mb-3 text-xs text-muted-foreground">/{alliance.slug}</div>
            )}
            {alliance.slug ? (
              <Link className="text-sm underline" href={`/alliances/${alliance.slug}`}>
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

export default async function AlliancesPage() {
  return (
    <RequireFeature feature={AppFeature.ALLIANCES}>
      <AlliancesContent />
    </RequireFeature>
  );
}
