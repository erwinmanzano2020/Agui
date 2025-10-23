import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { loadGuildDetail, formatGuildType } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";
import { pluralize } from "@/lib/utils";

export default async function GuildDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const [detail, terms] = await Promise.all([
    loadGuildDetail(params.slug),
    loadUiTerms(),
  ]);

  if (!detail) {
    notFound();
  }

  const guildLabel = terms.guild;
  const guildPlural = pluralize(guildLabel);
  const companyPlural = pluralize(terms.company);
  const motto = detail.motto?.trim();
  const stats = detail.stats;

  const metricCards = [
    {
      key: "players",
      title: "Players",
      value: stats.memberCount,
      description: `Registered members inside this ${guildLabel.toLowerCase()}.`,
    },
    {
      key: "companies",
      title: companyPlural,
      value: stats.houseCount,
      description: `${companyPlural} linked to this ${guildLabel.toLowerCase()}.`,
    },
    {
      key: "parties",
      title: "Parties",
      value: stats.partyCount,
      description: `Active parties and crews operating under this ${guildLabel.toLowerCase()}.`,
    },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-3">
        <Link
          href="/guilds"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to {guildPlural.toLowerCase()}
        </Link>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-foreground">{detail.name}</h1>
            <Badge tone="on">{formatGuildType(detail.guild_type)} Guild</Badge>
          </div>
          {motto && <p className="text-sm text-muted-foreground">“{motto}”</p>}
        </div>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Operations</h2>
          <p className="text-sm text-muted-foreground">
            Quick snapshot of members, {companyPlural.toLowerCase()}, and parties at a glance.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {metricCards.map((card) => (
            <Card key={card.key} className="h-full">
              <CardHeader className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <div className="text-3xl font-semibold text-foreground">{card.value}</div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{card.description}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Modules</h2>
          <p className="text-sm text-muted-foreground">
            Loyalty and inventory tools stay in sync with the members and {companyPlural.toLowerCase()} you manage here.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Loyalty</p>
                <Badge tone="off">Coming soon</Badge>
              </div>
              <h3 className="text-lg font-semibold text-foreground">{terms.guild_card}</h3>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Manage {terms.guild_card.toLowerCase()} and {terms.house_pass.toLowerCase()} enrollment for loyal patrons across this {guildLabel.toLowerCase()}.
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">Inventory</p>
                <Badge tone="off">Planning</Badge>
              </div>
              <h3 className="text-lg font-semibold text-foreground">Catalog</h3>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Track stock, adopt new items, and sync price lists across {companyPlural.toLowerCase()} within this {guildLabel.toLowerCase()}.
            </CardContent>
          </Card>
        </div>
      </section>

      {stats.memberCount === 0 && stats.houseCount === 0 && stats.partyCount === 0 && (
        <EmptyState
          title="No activity yet"
          description={`Invite players, register ${companyPlural.toLowerCase()}, or create parties to bring this ${guildLabel.toLowerCase()} to life.`}
        />
      )}
    </div>
  );
}
