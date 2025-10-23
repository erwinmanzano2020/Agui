import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentEntity } from "@/lib/auth/entity";
import { ensureHousePassScheme } from "@/lib/loyalty/schemes-server";
import { getSupabase } from "@/lib/supabase";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";
import { loadUiTerms } from "@/lib/ui-terms";

import { PatronPassForm } from "./patron-pass-form";

export default async function PatronPassPage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = params.slug;
  const terms = await loadUiTerms();
  const passLabel = terms.house_pass;

  let supabase;
  let supabaseError: string | null = null;
  try {
    supabase = getSupabase();
  } catch {
    supabase = null;
    supabaseError = "Supabase isn’t configured, so patron passes can’t be issued yet.";
  }

  let houseName = slug;
  let guildName: string | null = null;
  let allowIncognito = true;
  let canIssue = false;
  let gateMessage: string | null = supabaseError;

  if (supabase && !gateMessage) {
    try {
      const house = await loadHouseBySlug(supabase, slug);
      if (!house) {
        gateMessage = "We couldn’t find that company.";
      } else {
        houseName = house.name;
        guildName = house.guild?.name ?? null;

        const currentEntity = await getCurrentEntity({ supabase });
        if (!currentEntity) {
          gateMessage = `Sign in to issue a ${passLabel.toLowerCase()}.`;
        } else {
          const { data: houseRole, error: houseRoleError } = await supabase
            .from("house_roles")
            .select("id")
            .eq("house_id", house.id)
            .eq("entity_id", currentEntity.id)
            .maybeSingle();

          let hasAccess = false;
          if (houseRoleError) {
            console.error("Failed to verify house role while preparing patron pass issuance", houseRoleError);
            gateMessage = "We couldn’t verify your role at this house. Try again later.";
          } else if (houseRole) {
            hasAccess = true;
          } else {
            const { data: guildRole, error: guildRoleError } = await supabase
              .from("guild_roles")
              .select("id")
              .eq("guild_id", house.guild_id)
              .eq("entity_id", currentEntity.id)
              .maybeSingle();

            if (guildRoleError) {
              console.error("Failed to verify guild role while preparing patron pass issuance", guildRoleError);
              gateMessage = "We couldn’t verify your guild role just yet.";
            } else if (!guildRole) {
              gateMessage = "Only house or guild staff can issue patron passes.";
            } else {
              hasAccess = true;
            }
          }

          if (hasAccess) {
            const scheme = await ensureHousePassScheme({
              supabase,
              house,
              housePassLabel: passLabel,
            });
            allowIncognito = scheme.allow_incognito;
            canIssue = true;
          }
        }
      }
    } catch (error) {
      console.error("Failed to prepare patron pass issuance", error);
      gateMessage = "We couldn’t load the loyalty scheme for this company.";
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{guildName ? `${guildName} · Loyalty` : "Company loyalty"}</p>
        <h1 className="text-3xl font-semibold text-foreground">Issue {passLabel}</h1>
        <p className="text-sm text-muted-foreground">
          Enroll patrons to {houseName}’s loyalty perks. Each pass ties back to the same entity graph.
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
              Search by contact to reuse an existing member record or create a new one on the fly.
            </p>
          </CardHeader>
          <CardContent>
            <PatronPassForm
              slug={slug}
              houseName={houseName}
              passLabel={passLabel}
              allowIncognito={allowIncognito}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
