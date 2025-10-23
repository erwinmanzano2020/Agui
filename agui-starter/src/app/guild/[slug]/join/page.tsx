import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { loadGuildDetail } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";

import { JoinGuildForm } from "./join-form";

export default async function GuildJoinPage({
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="space-y-4">
        <Link
          href={`/guild/${detail.slug}`}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Back to {detail.name}
        </Link>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold text-foreground">Join {detail.name}</h1>
            <Badge tone="on">Instant approval</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Apply with your preferred contact information to become a {guildLabel.toLowerCase()} member right away.
          </p>
        </div>
      </header>

      <JoinGuildForm slug={detail.slug} guildName={detail.name} guildLabel={guildLabel} />
    </div>
  );
}
