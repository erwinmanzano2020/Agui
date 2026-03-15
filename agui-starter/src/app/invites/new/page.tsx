import { InviteForm, type InviteRoleOption, type InviteScopeOption } from "@/components/auth/invite-form";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMyRoles } from "@/lib/authz/server";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { loadUiTerms } from "@/lib/ui-terms";

export const dynamic = "force-dynamic";

const HOUSE_INVITER_ROLES = new Set(["house_manager", "house_owner"]);
const GUILD_INVITER_ROLES = new Set(["guild_master", "guild_elder"]);

const COMPANY_ROLE_OPTIONS: InviteRoleOption[] = [
  {
    value: "house_staff",
    label: "Employee",
    description: "Clock-in, roster, and daily tools for frontline staff.",
  },
  {
    value: "house_manager",
    label: "Manager",
    description: "Full management access to schedules, payroll, and operations.",
  },
  {
    value: "cashier",
    label: "Accountant",
    description: "POS, sales, and financial reporting access.",
  },
];

const GUILD_ROLE_OPTIONS: InviteRoleOption[] = [
  {
    value: "guild_master",
    label: "Guild Master",
    description: "Complete control over guild settings and memberships.",
  },
  {
    value: "guild_elder",
    label: "Guild Elder",
    description: "Trusted access to help govern and manage the guild.",
  },
];

type HouseRow = {
  id: string;
  name: string;
  guild_id: string | null;
};

type GuildRow = {
  id: string;
  name: string;
};

function toHouseOptions(rows: HouseRow[]): InviteScopeOption[] {
  return rows.map((row) => ({
    type: "HOUSE" as const,
    id: row.id,
    guildId: row.guild_id,
    label: row.name,
    note: "Company",
    roleOptions: COMPANY_ROLE_OPTIONS,
  }));
}

function toGuildOptions(rows: GuildRow[]): InviteScopeOption[] {
  return rows.map((row) => ({
    type: "GUILD" as const,
    id: row.id,
    label: row.name,
    note: "Guild",
    roleOptions: GUILD_ROLE_OPTIONS,
  }));
}

export default async function NewInvitePage() {
  const nextPath = "/invites/new";
  const [{ supabase, user }, terms] = await Promise.all([requireAuth(nextPath), loadUiTerms()]);
  const roles = await getMyRoles(supabase);
  const service = getServiceSupabase();

  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(user, service);
  } catch (error) {
    console.error("Failed to resolve inviter entity", error);
  }

  const isGM = roles.PLATFORM.includes("game_master");

  let houseOptions: InviteScopeOption[] = [];
  let guildOptions: InviteScopeOption[] = [];

  if (isGM) {
    const [housesResult, guildsResult] = await Promise.all([
      service
        .from("houses")
        .select("id, name, guild_id")
        .order("name", { ascending: true })
        .limit(100),
      service.from("guilds").select("id, name").order("name", { ascending: true }).limit(100),
    ]);

    if (housesResult.error) {
      console.error("Failed to load houses for invite form", housesResult.error);
    } else {
      houseOptions = toHouseOptions(housesResult.data ?? []);
    }

    if (guildsResult.error) {
      console.error("Failed to load guilds for invite form", guildsResult.error);
    } else {
      guildOptions = toGuildOptions(guildsResult.data ?? []);
    }
  } else if (entityId) {
    const [houseRolesResult, guildRolesResult] = await Promise.all([
      service
        .from("house_roles")
        .select("house_id, role")
        .eq("entity_id", entityId),
      service
        .from("guild_roles")
        .select("guild_id, role")
        .eq("entity_id", entityId),
    ]);

    if (houseRolesResult.error) {
      console.error("Failed to load company roles for invites", houseRolesResult.error);
    } else {
      const allowedHouseIds = Array.from(
        new Set(
          (houseRolesResult.data ?? [])
            .filter((entry) => HOUSE_INVITER_ROLES.has(entry.role ?? ""))
            .map((entry) => entry.house_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
      if (allowedHouseIds.length > 0) {
        const housesLookup = await service
          .from("houses")
          .select("id, name, guild_id")
          .in("id", allowedHouseIds)
          .order("name", { ascending: true });
        if (housesLookup.error) {
          console.error("Failed to load permitted houses for invites", housesLookup.error);
        } else {
          houseOptions = toHouseOptions(housesLookup.data ?? []);
        }
      }
    }

    if (guildRolesResult.error) {
      console.error("Failed to load guild roles for invites", guildRolesResult.error);
    } else {
      const allowedGuildIds = Array.from(
        new Set(
          (guildRolesResult.data ?? [])
            .filter((entry) => GUILD_INVITER_ROLES.has(entry.role ?? ""))
            .map((entry) => entry.guild_id)
            .filter((id): id is string => typeof id === "string" && id.length > 0),
        ),
      );
      if (allowedGuildIds.length > 0) {
        const guildsLookup = await service
          .from("guilds")
          .select("id, name")
          .in("id", allowedGuildIds)
          .order("name", { ascending: true });
        if (guildsLookup.error) {
          console.error("Failed to load permitted guilds for invites", guildsLookup.error);
        } else {
          guildOptions = toGuildOptions(guildsLookup.data ?? []);
        }
      }
    }
  }

  const scopeOptions = [...houseOptions, ...guildOptions].sort((a, b) => a.label.localeCompare(b.label));
  const defaultScopeId = houseOptions[0]?.id ?? guildOptions[0]?.id ?? undefined;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Invite a teammate</h1>
        <p className="text-sm text-muted-foreground">
          Send a Supabase invite so new members can join your {terms.team.toLowerCase()} with the right access.
        </p>
      </header>

      {scopeOptions.length === 0 && (
        <div className="rounded-[var(--agui-radius)] border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
          You don’t have any guild or company permissions that allow sending invites yet.
        </div>
      )}

      <InviteForm
        scopes={scopeOptions}
        heading="Send invite"
        description="Choose the organization and role assignments for this invite."
        defaultScopeId={defaultScopeId}
        defaultRoles={["house_staff"]}
        emptyMessage="Select an organization to continue."
      />
    </div>
  );
}
