import { notFound, redirect } from "next/navigation";

import { InviteForm, type InviteRoleOption } from "@/components/auth/invite-form";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMyRoles } from "@/lib/authz/server";

export const dynamic = "force-dynamic";

const GUILD_ROLE_OPTIONS: InviteRoleOption[] = [
  { value: "guild_master", label: "Guild Master", description: "Full control over guild operations." },
  { value: "guild_elder", label: "Guild Elder", description: "Trusted elder access for guild governance." },
];

function forbid(nextPath: string): never {
  const params = new URLSearchParams({ dest: nextPath });
  redirect(`/403?${params.toString()}`);
}

export default async function GuildInvitePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const nextPath = `/guild/${slug}/team/invite`;
  const { supabase } = await requireAuth(nextPath);
  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  const isGuildMaster = roles.GUILD.includes("guild_master");
  const isGuildElder = roles.GUILD.includes("guild_elder");

  if (!isGM && !isGuildMaster && !isGuildElder) {
    forbid(nextPath);
  }

  const { data: guild, error } = await supabase
    .from("guilds")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load guild for invite page", error);
  }

  if (!guild) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <InviteForm
        scope="GUILD"
        guildId={guild.id}
        roleOptions={GUILD_ROLE_OPTIONS}
        heading={`Invite to ${guild.name}`}
        description="Invite leaders to help govern this guild."
      />
    </div>
  );
}
