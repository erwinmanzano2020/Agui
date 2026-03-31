import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccess } from "@/lib/hr/access";

export default async function HrIndexPage({ params }: { params: { slug: string } }) {
  const basePath = `/company/${params.slug}/hr`;
  const { supabase } = await requireAuth(basePath);
  const { data: house } = await supabase.from("houses").select("id").eq("slug", params.slug).maybeSingle();
  if (!house) notFound();
  await requireHrAccess(supabase, house.id);
  redirect(`/company/${params.slug}/hr/employees`);
}
