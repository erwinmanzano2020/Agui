import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentEntity } from "@/lib/auth/entity";
import { ensureGuildCardScheme } from "@/lib/loyalty/schemes-server";
import { getSupabase } from "@/lib/supabase";
import { ensureGuildRecord } from "@/lib/taxonomy/guilds-server";
import { loadGuildDetail } from "@/lib/taxonomy/guilds";
import { loadUiTerms } from "@/lib/ui-terms";

import { GuildCardIssueForm } from "./guild-card-form";

export default async function GuildCardIssuePage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;
  const [detail, terms] = await Promise.all([loadGuildDetail(slug), loadUiTerms()]);

  if (!detail) {
    notFound();
  }

  const guildLabel = terms.guild;
  const passLabel = terms.guild_card;

  let supabase;
  let supabaseError: string | null = null;
  try {
    supabase = getSupabase();
  } catch {
    supabase = null;
    supabaseError = "Supabase isn’t configured, so guild cards can’t be issued yet.";
  }

  let allowIncognito = true;
  let canIssue = false;
  let gateMessage: string | null = supabaseError;

  if (supabase && !gateMessage) {
    try {
      const guildRecord = await ensureGuildRecord(supabase, slug);
      if (!guildRecord) {
        gateMessage = `This ${guildLabel.toLowerCase()} isn’t fully set up yet.`;
      } else {
        const currentEntity = await getCurrentEntity({ supabase });
        if (!currentEntity) {
          gateMessage = `Sign in to issue a ${passLabel.toLowerCase()}.`;
        } else {
          const { data: membership, error: membershipError } = await supabase
            .from("guild_roles")
            .select("id")
            .eq("guild_id", guildRecord.id)
            .eq("entity_id", currentEntity.id)
            .maybeSingle();

          if (membershipError) {
            console.error("Failed to verify guild membership while loading card issuance", membershipError);
            gateMessage = "We couldn’t verify your membership right now. Try again later.";
          } else if (!membership) {
            gateMessage = `Only ${guildLabel.toLowerCase()} members can issue ${passLabel.toLowerCase()}s.`;
          } else {
            const scheme = await ensureGuildCardScheme({ supabase, guild: guildRecord });
            allowIncognito = scheme.allow_incognito;
            canIssue = true;
          }
        }
      }
    } catch (error) {
      console.error("Failed to prepare guild card issuance", error);
      gateMessage = "We couldn’t load the loyalty scheme for this guild.";
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{guildLabel} loyalty</p>
        <h1 className="text-3xl font-semibold text-foreground">Issue {passLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Search by contact, resolve existing members, and hand out {passLabel.toLowerCase()}s instantly.
        </p>
      </header>

      {gateMessage && (
        <Card>
          <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
            <p>{gateMessage}</p>
          </CardContent>
        </Card>
      )}

      {canIssue && (
        <Card>
          <CardHeader className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Lookup and issue</h2>
            <p className="text-sm text-muted-foreground">
              Enter a contact to find the member or create a new entity for them.
            </p>
          </CardHeader>
          <CardContent>
            <GuildCardIssueForm
              slug={slug}
              guildName={detail.name}
              passLabel={passLabel}
              allowIncognito={allowIncognito}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
