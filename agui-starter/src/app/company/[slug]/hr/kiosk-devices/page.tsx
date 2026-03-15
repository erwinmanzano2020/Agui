import { notFound } from "next/navigation";

import { KioskDevicesClient } from "./KioskDevicesClient";
import { requireAuth } from "@/lib/auth/require-auth";
import { listBranchesForHouse } from "@/lib/hr/employees-server";
import { listKioskDevicesForHouse } from "@/lib/hr/kiosk/admin";

export default async function KioskDevicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/kiosk-devices`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase.from("houses").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!house) notFound();

  const [branchesResult, devices] = await Promise.all([
    listBranchesForHouse(supabase, house.id),
    listKioskDevicesForHouse(supabase, house.id),
  ]);

  return (
    <KioskDevicesClient
      houseId={house.id}
      houseSlug={house.slug ?? slug}
      branches={branchesResult.branches}
      initialDevices={devices}
    />
  );
}
