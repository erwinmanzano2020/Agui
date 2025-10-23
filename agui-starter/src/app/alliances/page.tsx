import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { loadAllianceSummaries } from "@/lib/taxonomy/alliances";
import { loadUiTerms } from "@/lib/ui-terms";
import { pluralize } from "@/lib/utils";

export default async function AlliancesPage() {
  const [alliances, terms] = await Promise.all([loadAllianceSummaries(), loadUiTerms()]);
  const allianceLabel = terms.alliance;
  const guildLabel = terms.guild;
  const alliancePlural = pluralize(allianceLabel);
  const guildPlural = pluralize(guildLabel).toLowerCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {alliancePlural}
        </p>
        <h1 className="text-3xl font-semibold text-foreground">Alliance Directory</h1>
        <p className="text-sm text-muted-foreground">
          Discover the coalitions connecting your {guildPlural} and coordinating shared missions.
        </p>
      </header>

      {alliances.length === 0 ? (
        <EmptyState
          title={`No ${alliancePlural.toLowerCase()} yet`}
          description={`Create your first ${allianceLabel.toLowerCase()} to link ${guildPlural} under one banner.`}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {alliances.map((alliance) => {
            const href = alliance.slug ? `/alliances/${alliance.slug}` : null;
            const motto = alliance.motto?.trim();
            const body = (
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">{alliance.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {motto ?? `This ${allianceLabel.toLowerCase()} hasn't shared a motto yet.`}
                  </p>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {href
                    ? `Open to view ${guildPlural} aligned with this ${allianceLabel.toLowerCase()}.`
                    : `Add a slug to share this ${allianceLabel.toLowerCase()} externally.`}
                </CardContent>
              </Card>
            );

            if (!href) {
              return <div key={alliance.id}>{body}</div>;
            }

            return (
              <Link
                key={alliance.id}
                href={href}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agui-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agui-surface)]"
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
