import type { SupabaseClient } from "@supabase/supabase-js";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getCurrentEntity } from "@/lib/auth/entity";
import { loadHouseInventory } from "@/lib/inventory/items-server";
import { getSupabase } from "@/lib/supabase";
import { loadHouseBySlug } from "@/lib/taxonomy/houses-server";
import { loadUiTerms } from "@/lib/ui-terms";
import { pluralize } from "@/lib/utils";

import { InventoryScanHud } from "./inventory-hud";
import { mapInventoryItems, type InventoryScanState } from "./state";

export default async function InventoryScanPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const terms = await loadUiTerms();
  const companyLabel = terms.company;
  const companyPlural = pluralize(companyLabel);

  let supabase: SupabaseClient | null;
  try {
    supabase = getSupabase();
  } catch {
    supabase = null;
  }

  if (!supabase) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">Inventory</p>
          <h1 className="text-3xl font-semibold text-foreground">Adopt inventory</h1>
          <p className="text-sm text-muted-foreground">
            Configure Supabase to scan barcodes and manage inventory for your {companyPlural.toLowerCase()}.
          </p>
        </header>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Supabase isn’t configured, so inventory scans and updates can’t be processed yet.
          </CardContent>
        </Card>
      </div>
    );
  }

  let house;
  try {
    house = await loadHouseBySlug(supabase, slug);
  } catch (error) {
    console.error("Failed to load house for inventory", error);
    house = null;
  }

  if (!house) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
        <header className="space-y-2">
          <p className="text-sm text-muted-foreground">Inventory</p>
          <h1 className="text-3xl font-semibold text-foreground">Adopt inventory</h1>
        </header>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            We couldn’t find that company. Confirm the link from your guild roster.
          </CardContent>
        </Card>
      </div>
    );
  }

  const houseName = house.name;
  const guildName = house.guild?.name ?? null;

  const actor = await getCurrentEntity({ supabase }).catch(() => null);

  let gateMessage: string | null = null;
  let canManage = false;

  if (!actor) {
    gateMessage = "Sign in to manage inventory.";
  } else {
    const [houseRoleResult, guildRoleResult] = await Promise.all([
      supabase
        .from("house_roles")
        .select("id")
        .eq("house_id", house.id)
        .eq("entity_id", actor.id)
        .maybeSingle(),
      house.guild_id
        ? supabase
            .from("guild_roles")
            .select("id")
            .eq("guild_id", house.guild_id)
            .eq("entity_id", actor.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (houseRoleResult.error) {
      console.error("Failed to verify house role for inventory", houseRoleResult.error);
      gateMessage = "We couldn’t verify your role at this company yet.";
    } else if (houseRoleResult.data) {
      canManage = true;
    } else if (guildRoleResult.error) {
      console.error("Failed to verify guild role for inventory", guildRoleResult.error);
      gateMessage = "We couldn’t verify your guild role just yet.";
    } else if (guildRoleResult.data) {
      canManage = true;
    } else {
      gateMessage = "Only house or guild staff can manage inventory here.";
    }
  }

  let initialState: InventoryScanState = {
    status: "idle",
    message: null,
    items: [],
    highlightHouseItemId: null,
  } satisfies InventoryScanState;

  if (canManage) {
    try {
      const inventory = await loadHouseInventory(supabase, house.id);
      initialState = {
        status: "idle",
        message: null,
        items: mapInventoryItems(inventory),
        highlightHouseItemId: null,
      } satisfies InventoryScanState;
    } catch (error) {
      console.error("Failed to load inventory list", error);
      initialState = {
        status: "error",
        message: "We couldn’t load the current inventory yet. Try again soon.",
        items: [],
        highlightHouseItemId: null,
      } satisfies InventoryScanState;
    }
  }

  const heading = `${houseName} · Inventory`;
  const intro = guildName
    ? `Adopt global items for ${houseName} and keep ${guildName} catalog pricing in sync.`
    : `Adopt global items for ${houseName} and manage price, SKU, and stock per house.`;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">Inventory</p>
        <h1 className="text-3xl font-semibold text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">{intro}</p>
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

      {canManage && (
        <InventoryScanHud slug={slug} houseName={houseName} initialState={initialState} />
      )}
    </div>
  );
}
