import { notFound } from "next/navigation";

import { EmployeesClient } from "./EmployeesClient";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import { listBranchesForHouse, listEmployeesByHouse } from "@/lib/hr/employees-server";
import type { EmployeeListFilters } from "@/lib/hr/employees";

function normalizeFilters(
  rawSearch: Record<string, string | string[] | undefined>,
  allowedBranchIds: string[],
): EmployeeListFilters & { branchId: string | null; search: string; status: string } {
  const rawStatus = typeof rawSearch.status === "string" ? rawSearch.status : undefined;
  const status = rawStatus === "inactive" || rawStatus === "all" ? rawStatus : "active";

  const branchParam = typeof rawSearch.branch === "string" ? rawSearch.branch : undefined;
  const branchId = branchParam && allowedBranchIds.includes(branchParam) ? branchParam : null;

  const search = typeof rawSearch.q === "string" ? rawSearch.q : "";

  return { status, branchId, search };
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HrEmployeesPage({ params, searchParams }: Props) {
  const [{ slug }, rawSearch = {}] = await Promise.all([params, searchParams ?? Promise.resolve({})]);
  const basePath = `/company/${slug}/hr/employees`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const hrAccess = await requireHrAccessWithBranch(supabase, { houseId: house.id });
  if (!hrAccess.allowed) {
    notFound();
  }
  const branchResult = await listBranchesForHouse(supabase, house.id);
  const accessibleBranches = hrAccess.isBranchLimited
    ? branchResult.branches.filter((branch) => hrAccess.allowedBranchIds.includes(branch.id))
    : branchResult.branches;
  const allowedBranchIds = accessibleBranches.map((branch) => branch.id);
  const filters = normalizeFilters(rawSearch, allowedBranchIds);
  const branchNames = Object.fromEntries(accessibleBranches.map((branch) => [branch.id, branch.name]));

  const employeesResult = await listEmployeesByHouse(supabase, house.id, filters, {
    readScope: {
      isBranchLimited: hrAccess.isBranchLimited,
      allowedBranchIds: hrAccess.allowedBranchIds,
    },
    branchNames,
    includeIdentity: true,
  });

  return (
    <EmployeesClient
      basePath={basePath}
      employees={employeesResult.employees}
      branches={accessibleBranches}
      branchLoadError={branchResult.error}
      employeeLoadError={employeesResult.error}
      initialFilters={{ status: filters.status, branchId: filters.branchId, search: filters.search ?? "" }}
    />
  );
}
