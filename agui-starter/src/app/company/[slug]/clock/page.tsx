import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentEntity } from "@/lib/auth/entity";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";
import { loadUiTerms } from "@/lib/ui-terms";
import { requireAuth } from "@/lib/auth/require-auth";
import { z } from "zod";
import ScanHUD from "./scan-hud";

if (process.env.NODE_ENV !== "production" && typeof z?.object !== "function") {
  throw new Error(
    "Zod import for /company/[slug]/clock/page.tsx is misconfigured. Use `import { z } from \"zod\"`.",
  );
}

export const dynamic = "force-dynamic";

export default async function CompanyClockPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const terms = await loadUiTerms();
  const clockLabel = "Attendance";
  const nextPath = `/company/${slug}/clock`;
  const { supabase } = await requireAuth(nextPath);
  await requireFeatureAccess(AppFeature.SHIFTS, { dest: nextPath });
  const house = await loadHouseBySlug(supabase, slug);
  if (!house) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">Company clock</p>
          <h1 className="text-3xl font-semibold text-foreground">{clockLabel}</h1>
        </header>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            We couldn’t find that company. Confirm the link from the guild roster.
          </CardContent>
        </Card>
      </div>
    );
  }

  const actor = await getCurrentEntity({ supabase }).catch(() => null);

  let gateMessage: string | null = null;
  if (!actor) {
    gateMessage = `Sign in to access the ${terms.house_pass.toLowerCase()} clock.`;
  } else {
    const [{ data: houseRole }, { data: guildRole }] = await Promise.all([
      supabase
        .from("house_roles")
        .select("id")
        .eq("house_id", house.id)
        .eq("entity_id", actor.id)
        .maybeSingle(),
      supabase
        .from("guild_roles")
        .select("id")
        .eq("guild_id", house.guild_id)
        .eq("entity_id", actor.id)
        .maybeSingle(),
    ]);

    if (!houseRole && !guildRole) {
      gateMessage = "Only house or guild staff can resolve scans here.";
    }
  }

  const heading = `${house.name} · ${clockLabel}`;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Company clock</p>
        <h1 className="text-3xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          Resolve pass scans to clock patrons in. Incognito stays respected unless you log an override.
        </p>
      </header>

      {gateMessage && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-foreground">Access needed</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{gateMessage}</p>
          </CardContent>
        </Card>
      )}

      {!gateMessage && <ScanHUD companyId={house.id} guildId={house.guild_id} />}
    </div>
  );
}
