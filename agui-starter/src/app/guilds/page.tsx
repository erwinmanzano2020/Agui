import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { loadGuildSummaries, formatGuildType } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";
import { pluralize } from "@/lib/utils";

export default async function GuildsPage() {
  const [guilds, terms] = await Promise.all([loadGuildSummaries(), loadUiTerms()]);
  const guildLabel = terms.guild;
  const guildPlural = pluralize(guildLabel);
  const companyPlural = pluralize(terms.company).toLowerCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {guildPlural}
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Guild Registry</h1>
        <p className="text-sm text-muted-foreground">
          Track member rosters, aligned {companyPlural}, and upcoming missions for each {guildLabel.toLowerCase()}.
        </p>
      </header>

      {guilds.length === 0 ? (
        <EmptyState
          title={`No ${guildPlural.toLowerCase()} yet`}
          description={`Create a ${guildLabel.toLowerCase()} to begin organizing members and ${companyPlural}.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {guilds.map((guild) => {
            const motto = guild.motto?.trim();
            return (
              <Link
                key={guild.id}
                href={`/guild/${guild.slug}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agui-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agui-surface)]"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-semibold text-foreground">{guild.name}</h2>
                      <Badge>{formatGuildType(guild.guild_type)}</Badge>
                    </div>
                    {motto && <p className="text-sm text-muted-foreground">“{motto}”</p>}
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    View members, {companyPlural}, and parties for this {guildLabel.toLowerCase()}.
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
