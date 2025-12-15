import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/require-auth";
import { getEmployeeByIdForHouse } from "@/lib/hr/employees-server";

type Props = { params: Promise<{ slug: string; id: string }> };

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(
    amount,
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function EmployeeProfilePage({ params }: Props) {
  const { slug, id } = await params;
  const basePath = `/company/${slug}/hr/employees/${id}`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const employee = await getEmployeeByIdForHouse(supabase, house.id, id);

  if (!employee) {
    notFound();
  }

  const branchName = employee.branch_name ?? "Unassigned";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href={`/company/${slug}/hr/employees`} className="underline">
            Employees
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">{employee.full_name}</h1>
            <p className="text-sm text-muted-foreground">Code: {employee.code}</p>
          </div>
          <Badge tone={employee.status === "active" ? "on" : "off"} className="uppercase">
            {employee.status}
          </Badge>
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Summary</h2>
          <p className="text-sm text-muted-foreground">Core details for this employee.</p>
        </div>
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="text-base font-medium text-foreground">{employee.full_name}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Code</dt>
            <dd className="text-base font-medium text-foreground">{employee.code}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Branch</dt>
            <dd className="text-base font-medium text-foreground">{branchName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Rate per day</dt>
            <dd className="text-base font-medium text-foreground">{formatCurrency(employee.rate_per_day)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="text-base font-medium text-foreground">{formatDate(employee.created_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quick links</h2>
          <p className="text-sm text-muted-foreground">Shortcuts coming soon.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <button className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-left text-sm" disabled>
            DTR (Coming soon)
          </button>
          <button className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-left text-sm" disabled>
            Payroll history (Coming soon)
          </button>
          <button className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-left text-sm" disabled>
            Payslips (Coming soon)
          </button>
        </div>
      </Card>
    </div>
  );
}
