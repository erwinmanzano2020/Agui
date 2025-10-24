import { notFound } from "next/navigation";

import { StatCard } from "@/components/ui/stat-card";
import { getSupabase } from "@/lib/supabase";
import { labels } from "@/lib/labels";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GuildDetail({
  params,
}: {
  params: { slug: string };
}) {
  const l = await labels();

  let db: ReturnType<typeof getSupabase> | null = null;
  try {
    db = getSupabase();
  } catch (error) {
    console.error("Failed to initialize Supabase", error);
  }

  if (!db) {
    return notFound();
  }

  type GuildRecord = {
    id: string;
    slug: string;
    name: string;
    guild_type: string | null;
  };

  let guild: GuildRecord | null = null;

  const guildRes = await db
    .from("guilds")
    .select("id,slug,name,guild_type")
    .eq("slug", params.slug)
    .maybeSingle<GuildRecord>();

  if (guildRes.error) {
    console.warn("Failed to load guild", guildRes.error);
  } else {
    guild = guildRes.data ?? null;
  }

  if (!guild) {
    const legacyRes = await db
      .from("orgs_as_guilds")
      .select("id,slug,name,guild_type")
      .eq("slug", params.slug)
      .maybeSingle<GuildRecord>();

    if (legacyRes.error) {
      console.warn("Failed to load legacy guild view", legacyRes.error);
    } else {
      guild = legacyRes.data ?? null;
    }
  }

  if (!guild) {
    return notFound();
  }

  const roles = [
    "guild_master",
    "guild_elder",
    "staff",
    "supplier",
    "customer",
    "franchisee",
    "org_admin",
    "agui_user",
    "guild_member",
  ];

  const [memberRes, houseRes, partyRes] = await Promise.all([
    db
      .from("guild_roles")
      .select("entity_id", { count: "exact", head: true })
      .eq("guild_id", guild.id)
      .in("role", roles),
    db
      .from("houses")
      .select("id", { count: "exact", head: true })
      .eq("guild_id", guild.id),
    db
      .from("parties")
      .select("id", { count: "exact", head: true })
      .eq("scope", "GUILD")
      .eq("guild_id", guild.id),
  ]);

  const memberCount = memberRes.error ? 0 : memberRes.count ?? 0;
  const houseCount = houseRes.error ? 0 : houseRes.count ?? 0;
  const partyCount = partyRes.error ? 0 : partyRes.count ?? 0;

  let loyaltyCount = 0;
  try {
    const { count, error: loyaltyError } = await db
      .from("loyalty_schemes")
      .select("id", { count: "exact", head: true })
      .eq("scope", "GUILD")
      .eq("design->>guild_slug", guild.slug);
    if (!loyaltyError) {
      loyaltyCount = count ?? 0;
    }
  } catch (loyaltyError) {
    console.warn("Loyalty schemes table unavailable", loyaltyError);
  }

  let inventoryItems = 0;
  try {
    const { data: houses, error: housesError } = await db
      .from("houses")
      .select("id")
      .eq("guild_id", guild.id);
    if (!housesError) {
      const houseIds = (houses ?? []).map((house) => house.id);
      if (houseIds.length > 0) {
        const { count, error: itemsError } = await db
          .from("house_items")
          .select("id", { count: "exact", head: true })
          .in("house_id", houseIds);
        if (!itemsError) {
          inventoryItems = count ?? 0;
        }
      }
    }
  } catch (inventoryError) {
    console.warn("Inventory tables unavailable", inventoryError);
  }

  const teamLabel = pluralize(l.team);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xl font-semibold">{guild.name}</div>
          <div className="text-xs text-muted-foreground">/{guild.slug}</div>
        </div>
        {guild.guild_type && (
          <div className="text-xs text-muted-foreground">{guild.guild_type}</div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard value={memberCount} label={`${l.guild} Players`} />
        <StatCard value={houseCount} label={`${l.company} Count`} />
        <StatCard value={partyCount} label={teamLabel} />
        <StatCard value={loyaltyCount} label="Loyalty Schemes" />
        <StatCard value={inventoryItems} label="Inventory Items" />
      </div>
    </div>
  );
}
