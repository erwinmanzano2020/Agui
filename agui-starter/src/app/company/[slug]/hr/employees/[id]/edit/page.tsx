import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEmployeeForm } from "../EditEmployeeForm";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import { getEmployeeByIdForHouse, listBranchesForHouse } from "@/lib/hr/employees-server";

type Props = { params: Promise<{ slug: string; id: string }> };

export default async function EditEmployeePage({ params }: Props) {
  const { slug, id } = await params;
  const basePath = `/company/${slug}/hr/employees/${id}/edit`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const access = await requireHrAccessWithBranch(supabase, { houseId: house.id });
  if (!access.allowed) {
    notFound();
  }
  const [employee, branchResult] = await Promise.all([
    getEmployeeByIdForHouse(supabase, house.id, id, {
      readScope: {
        isBranchLimited: access.isBranchLimited,
        allowedBranchIds: access.allowedBranchIds,
      },
    }),
    listBranchesForHouse(supabase, house.id),
  ]);

  if (!employee) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/company/${slug}/hr/employees`} className="underline">
          Employees
        </Link>{" "}
        →{" "}
        <Link href={`/company/${slug}/hr/employees/${id}`} className="underline">
          {employee.full_name}
        </Link>{" "}
        → Edit
      </div>

      <EditEmployeeForm
        employee={employee}
        branches={branchResult.branches}
        branchLoadError={branchResult.error}
        houseId={house.id}
        houseSlug={slug}
      />
    </div>
  );
}
