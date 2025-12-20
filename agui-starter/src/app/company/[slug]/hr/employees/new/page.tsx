import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth/require-auth";
import { listBranchesForHouse } from "@/lib/hr/employees-server";

import { CreateEmployeeForm } from "./CreateEmployeeForm";

type Props = { params: Promise<{ slug: string }> };

export default async function NewEmployeePage({ params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/employees`;
  const { supabase } = await requireAuth(`${basePath}/new`);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const branchResult = await listBranchesForHouse(supabase, house.id);

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={basePath} className="underline">
          Employees
        </Link>
        {" · "}Add employee
      </div>
      <CreateEmployeeForm
        houseId={house.id}
        houseSlug={house.slug}
        branches={branchResult.branches}
        branchLoadError={branchResult.error}
      />
    </div>
  );
}
