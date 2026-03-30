import { notFound } from "next/navigation";

import { EmployeeIdsClient } from "./EmployeeIdsClient";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
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

  const access = await requireHrAccessWithBranch(supabase, { houseId: house.id });
  if (!access.allowed) notFound();

  const branches = await listBranchesForHouse(supabase, house.id);
  const accessibleBranches = access.isBranchLimited
    ? branches.branches.filter((branch) => access.allowedBranchIds.includes(branch.id))
    : branches.branches;
  const allowedBranchIds = new Set(accessibleBranches.map((branch) => branch.id));

  const requestedBranchId = typeof search.branch === "string" ? search.branch : undefined;
  const branchId = requestedBranchId && allowedBranchIds.has(requestedBranchId) ? requestedBranchId : undefined;
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
      branches={accessibleBranches}
      initialBranchId={branchId ?? ""}
      initialSearch={codeSearch}
    />
  );
}
