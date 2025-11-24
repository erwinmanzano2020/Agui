import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { getSettingsSnapshot } from "@/lib/settings/server";
import { getMyEntityId } from "@/lib/authz/server";
import { requirePosAccess } from "@/lib/pos/access";

import EndShiftClient from "./pageClient";

export const dynamic = "force-dynamic";

export default async function EndShiftPage({ params }: { params: { slug: string } }) {
  const nextPath = `/company/${params.slug}/cashiering/end-shift`;
  const { supabase } = await requireAuth(nextPath);

  const { data: house, error } = await supabase
    .from("houses")
    .select("id, name, slug")
    .eq("slug", params.slug)
    .maybeSingle<{ id: string; name: string | null; slug: string }>();

  if (error) {
    console.error("Failed to load house for end shift", error);
  }

  if (!house) {
    return notFound();
  }

  await requirePosAccess(supabase, house.id, { dest: nextPath });

  const snapshot = await getSettingsSnapshot({
    category: "pos",
    businessId: house.id,
    branchId: house.id,
  });

  const floatDefaults =
    snapshot["pos.cash.float.defaults"]?.value && typeof snapshot["pos.cash.float.defaults"]?.value === "object"
      ? (snapshot["pos.cash.float.defaults"]?.value as Record<string, number>)
      : {};
  const blindDropEnabled = snapshot["pos.cash.blind_drop_enabled"]?.value ?? true;

  const cashierEntityId = await getMyEntityId(supabase);

  return (
    <EndShiftClient
      branchId={house.id}
      branchName={house.name ?? ""}
      cashierEntityId={cashierEntityId}
      blindDropEnabled={Boolean(blindDropEnabled)}
      floatDefaults={floatDefaults}
    />
  );
}
