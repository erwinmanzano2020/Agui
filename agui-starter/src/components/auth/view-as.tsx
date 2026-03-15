"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/session-context";
import { useActualUserRoles } from "@/lib/auth/user-roles-context";

type GuildSummary = { id: string; name: string };
type HouseSummary = { id: string; name: string };

type Option = {
  value: string;
  label: string;
  scope: "HOUSE" | "GUILD" | "REAL";
  selection: {
    scope: "HOUSE" | "GUILD";
    guildId?: string | null;
    houseId?: string | null;
    roles: string[];
  } | null;
};

function encodeSelection(selection: Option["selection"]): string {
  if (!selection) {
    return "REAL";
  }
  const roles = selection.roles.join(",");
  if (selection.scope === "HOUSE") {
    return `HOUSE:${selection.houseId ?? ""}:${roles}`;
  }
  return `GUILD:${selection.guildId ?? ""}:${roles}`;
}

export function ViewAsSwitcher() {
  const { supabase, viewAs, setViewAs, clearViewAs } = useSession();
  const roles = useActualUserRoles();
  const toast = useToast();
  const [houses, setHouses] = useState<HouseSummary[]>([]);
  const [guilds, setGuilds] = useState<GuildSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const isGM = roles.PLATFORM.includes("game_master");

  useEffect(() => {
    if (!supabase || !isGM) {
      setHouses([]);
      setGuilds([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const load = async () => {
      const [housesResult, guildsResult] = await Promise.all([
        supabase.from("houses").select("id, name").order("created_at", { ascending: true }).limit(10),
        supabase.from("guilds").select("id, name").order("created_at", { ascending: true }).limit(10),
      ]);

      if (cancelled) {
        return;
      }

      if (housesResult.error) {
        console.warn("Failed to load houses for view-as", housesResult.error);
      }
      if (guildsResult.error) {
        console.warn("Failed to load guilds for view-as", guildsResult.error);
      }

      setHouses(housesResult.data ?? []);
      setGuilds(guildsResult.data ?? []);
      setLoading(false);
    };

    load().catch((error) => {
      if (!cancelled) {
        console.warn("Failed to load view-as data", error);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [supabase, isGM]);

  const options = useMemo<Option[]>(() => {
    if (!isGM) {
      return [];
    }

    const base: Option[] = [
      {
        value: "REAL",
        label: "Use real access",
        scope: "REAL",
        selection: null,
      },
    ];

    const houseOptions: Option[] = houses.flatMap((house) => [
      {
        value: encodeSelection({ scope: "HOUSE", houseId: house.id, roles: ["house_manager"] }),
        label: `${house.name} — Manager`,
        scope: "HOUSE",
        selection: { scope: "HOUSE", houseId: house.id, roles: ["house_manager"] },
      },
      {
        value: encodeSelection({ scope: "HOUSE", houseId: house.id, roles: ["cashier"] }),
        label: `${house.name} — Cashier`,
        scope: "HOUSE",
        selection: { scope: "HOUSE", houseId: house.id, roles: ["cashier"] },
      },
      {
        value: encodeSelection({ scope: "HOUSE", houseId: house.id, roles: ["house_staff"] }),
        label: `${house.name} — Staff`,
        scope: "HOUSE",
        selection: { scope: "HOUSE", houseId: house.id, roles: ["house_staff"] },
      },
    ]);

    const guildOptions: Option[] = guilds.flatMap((guild) => [
      {
        value: encodeSelection({ scope: "GUILD", guildId: guild.id, roles: ["guild_master"] }),
        label: `${guild.name} — Guild Master`,
        scope: "GUILD",
        selection: { scope: "GUILD", guildId: guild.id, roles: ["guild_master"] },
      },
      {
        value: encodeSelection({ scope: "GUILD", guildId: guild.id, roles: ["guild_elder"] }),
        label: `${guild.name} — Guild Elder`,
        scope: "GUILD",
        selection: { scope: "GUILD", guildId: guild.id, roles: ["guild_elder"] },
      },
    ]);

    return base.concat(houseOptions, guildOptions);
  }, [guilds, houses, isGM]);

  if (!isGM) {
    return null;
  }

  const currentValue = encodeSelection(viewAs);

  const handleChange = (value: string) => {
    if (value === "REAL") {
      clearViewAs();
      toast.success("Using real access");
      return;
    }

    const selected = options.find((option) => option.value === value);
    if (!selected) {
      toast.error("Unknown view-as selection");
      return;
    }

    if (!selected.selection) {
      clearViewAs();
      return;
    }

    setViewAs(selected.selection);
    toast.success(`Viewing as ${selected.label}`);
  };

  if (!options.length) {
    return null;
  }

  return (
    <div className="hidden md:flex flex-col items-end gap-1 text-xs text-muted-foreground">
      <span className="font-medium">View as</span>
      <select
        className="h-8 rounded-[var(--agui-radius)] border border-border bg-background px-2 text-sm text-foreground"
        value={currentValue}
        onChange={(event) => handleChange(event.target.value)}
        disabled={loading}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
