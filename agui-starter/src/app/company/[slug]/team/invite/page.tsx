import { notFound } from "next/navigation";

import { InviteForm, type InviteRoleOption } from "@/components/auth/invite-form";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMyRoles } from "@/lib/authz/server";
import { AppFeature } from "@/lib/auth/permissions";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";

export const dynamic = "force-dynamic";

const HOUSE_ROLE_OPTIONS: InviteRoleOption[] = [
  { value: "house_manager", label: "House Manager", description: "Full management access to this house." },
  { value: "cashier", label: "Cashier", description: "POS access for front-of-house operations." },
  { value: "house_staff", label: "House Staff", description: "Clock in/out and basic staff tools." },
];

export default async function CompanyInvitePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const nextPath = `/company/${slug}/team/invite`;
  const { supabase } = await requireAuth(nextPath);
  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  const isHouseManager = roles.HOUSE.includes("house_manager");
  const isHouseOwner = roles.HOUSE.includes("house_owner");

  if (!isGM && !isHouseManager && !isHouseOwner) {
    await requireFeatureAccess(AppFeature.TEAM, { dest: nextPath });
  }

  const { data: house, error } = await supabase
    .from("houses")
    .select("id, name, guild_id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load house for invite page", error);
  }

  if (!house) {
    return notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-6">
      <InviteForm
        scopes={[
          {
            type: "HOUSE",
            id: house.id,
            guildId: house.guild_id,
            label: house.name,
            note: "Company",
            roleOptions: HOUSE_ROLE_OPTIONS,
          },
        ]}
        heading={`Invite to ${house.name}`}
        description="Send an email invite so your teammate can join this company with the right role."
        defaultScopeId={house.id}
      />
    </div>
  );
}
