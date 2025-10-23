import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getSupabase } from "@/lib/supabase";
import { loadUiTerms } from "@/lib/ui-terms";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GuildRecord } from "@/lib/taxonomy/guilds-server";

type HouseRow = {
  name: string;
  slug: string;
  house_type: string | null;
  guild: GuildRecord | null;
};

type PageProps = {
  params: { slug: string };
};

export default async function CompanyStubPage({ params }: PageProps) {
  const { slug } = params;
  const terms = await loadUiTerms();
  const companyLabel = terms.company;

  let supabase: SupabaseClient | null = null;
  try {
    supabase = getSupabase();
  } catch {
    supabase = null;
  }

  let house: HouseRow | null = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("houses")
        .select("name,slug,house_type,guild:guilds(id,name,slug)")
        .eq("slug", slug)
        .limit(1)
        .maybeSingle<HouseRow>();

      if (error) {
        console.warn(`Failed to load house for slug ${slug}`, error);
      } else {
        house = data;
      }
    } catch (error) {
      console.warn(`Unexpected error while loading house for slug ${slug}`, error);
    }
  }

  const title = house?.name ?? slug;
  const guildLink = house?.guild?.slug ? `/guild/${house.guild.slug}` : null;
  const guildName = house?.guild?.name ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">
          This is a placeholder page for the {companyLabel.toLowerCase()} with slug “{slug}”. We’ll flesh this out soon.
        </p>
        {guildLink && guildName && (
          <Link
            href={guildLink}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to {guildName}
          </Link>
        )}
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-foreground">What’s next?</h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            This stub confirms the {companyLabel.toLowerCase()} was created successfully. Soon you’ll be able to manage teams,
            locations, and loyalty programs from here.
          </p>
          {!supabase && (
            <p>
              Supabase isn’t configured, so we can’t load live details for this {companyLabel.toLowerCase()} yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
