import { notFound } from "next/navigation";

import { ClockClient } from "./clock-client";
import { requireAuth } from "@/lib/auth/require-auth";
import { getMyRoles } from "@/lib/authz/server";
import { AppFeature } from "@/lib/auth/permissions";
import { requireFeatureAccess } from "@/lib/auth/feature-guard";

export const dynamic = "force-dynamic";

export default async function ClockPage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const nextPath = `/company/${slug}/pos/clock`;
  const { supabase } = await requireAuth(nextPath);
  const roles = await getMyRoles(supabase);
  const isGM = roles.PLATFORM.includes("game_master");
  const isHouseStaff = roles.HOUSE.includes("house_staff");
  const isCashier = roles.HOUSE.includes("cashier");
  const isManager = roles.HOUSE.includes("house_manager");

  if (!isGM && !isHouseStaff && !isCashier && !isManager) {
    await requireFeatureAccess(AppFeature.POS, { dest: nextPath });
  }

  const { data: house, error } = await supabase
    .from("houses")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Failed to load house for clock page", error);
  }

  if (!house) {
    return notFound();
  }

  return <ClockClient houseId={house.id} houseName={house.name} />;
}
