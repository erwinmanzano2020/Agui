import { notFound } from "next/navigation";

import { EmployeeIdsClient } from "./EmployeeIdsClient";
import { requireAuth } from "@/lib/auth/require-auth";
import { listBranchesForHouse } from "@/lib/hr/employees-server";
import { listEmployeeIdCards } from "@/lib/hr/employee-id-cards-server";

export default async function EmployeeIdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const search = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | undefined>;
  const basePath = `/company/${slug}/hr/employee-ids`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase.from("houses").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!house) notFound();

  const branches = await listBranchesForHouse(supabase, house.id);
  const branchId = typeof search.branch === "string" ? search.branch : undefined;
  const codeSearch = typeof search.q === "string" ? search.q : "";
  const employees = await listEmployeeIdCards(supabase, house.id, {
    branchId: branchId || undefined,
    search: codeSearch,
  });

  return (
    <EmployeeIdsClient
      houseId={house.id}
      basePath={basePath}
      employees={employees}
      branches={branches.branches}
      initialBranchId={branchId ?? ""}
      initialSearch={codeSearch}
    />
  );
}
