import Link from "next/link";
import { notFound } from "next/navigation";

import { EditEmployeeForm } from "../EditEmployeeForm";
import { requireAuth } from "@/lib/auth/require-auth";
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

  const [employee, branches] = await Promise.all([
    getEmployeeByIdForHouse(supabase, house.id, id),
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

      <EditEmployeeForm employee={employee} branches={branches} houseId={house.id} houseSlug={slug} />
    </div>
  );
}
