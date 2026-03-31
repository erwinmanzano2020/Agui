import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccess } from "@/lib/hr/access";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function HrPayrollPage({ params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/payroll`;
  const { supabase } = await requireAuth(basePath);
  const { data: house } = await supabase
    .from("houses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!house) notFound();
  await requireHrAccess(supabase, house.id);
  redirect(`/company/${slug}/hr/payroll-runs`);
}
