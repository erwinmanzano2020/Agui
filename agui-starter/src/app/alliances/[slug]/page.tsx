import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import { loadAllianceDetail } from "@/lib/taxonomy/alliances";
import { formatGuildType } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";
import { pluralize } from "@/lib/utils";

export default async function AllianceDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const [detail, terms] = await Promise.all([
    loadAllianceDetail(params.slug),
    loadUiTerms(),
  ]);

  if (!detail) {
    notFound();
  }

  const allianceLabel = terms.alliance;
  const guildLabel = terms.guild;
  const alliancePlural = pluralize(allianceLabel);
  const guildPlural = pluralize(guildLabel);
  const motto = detail.motto?.trim();

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <header className="space-y-3">
        <Link
          href="/alliances"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to {alliancePlural.toLowerCase()}
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">{detail.name}</h1>
          {motto && <p className="text-sm text-muted-foreground">“{motto}”</p>}
        </div>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{guildPlural}</h2>
          <p className="text-sm text-muted-foreground">
            Guilds aligned with this {allianceLabel.toLowerCase()} appear below.
          </p>
        </div>

        {detail.guilds.length === 0 ? (
          <EmptyState
            title={`No ${guildPlural.toLowerCase()} yet`}
            description={`Once a ${guildLabel.toLowerCase()} joins this ${allianceLabel.toLowerCase()}, it will be listed here.`}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {detail.guilds.map((guild) => {
              const href = guild.slug ? `/guild/${guild.slug}` : null;
              const guildMotto = guild.motto?.trim();
              const body = (
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-foreground">{guild.name}</h3>
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {formatGuildType(guild.guild_type)}
                      </span>
                    </div>
                    {guildMotto && (
                      <p className="text-sm text-muted-foreground">“{guildMotto}”</p>
                    )}
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {href
                      ? `Review the roster and modules for this ${guildLabel.toLowerCase()}.`
                      : `Add a slug to let others explore this ${guildLabel.toLowerCase()}.`}
                  </CardContent>
                </Card>
              );

              if (!href) {
                return <div key={guild.id}>{body}</div>;
              }

              return (
                <Link
                  key={guild.id}
                  href={href}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--agui-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--agui-surface)]"
                >
                  {body}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
