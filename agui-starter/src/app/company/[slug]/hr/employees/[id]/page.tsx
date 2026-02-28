import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  const employee = await getEmployeeByIdForHouse(supabase, house.id, id, { includeIdentity: true });

  if (!employee) {
    notFound();
  }

  const branchName = employee.branch_name ?? "Unassigned";
  const identity = employee.identity ?? null;
  const identityLinked = Boolean(employee.entity_id);
  const identityUnavailable = employee.identity_unavailable === true;
  const emailIdentifiers = (identity?.identifiers ?? []).filter((identifier) => identifier.type === "EMAIL");
  const phoneIdentifiers = (identity?.identifiers ?? []).filter((identifier) => identifier.type === "PHONE");
  const identityBadgeTone = identityLinked && !identityUnavailable ? "on" : "off";
  const identityBadgeLabel = identityUnavailable
    ? "⚠️ Identity unavailable"
    : identityLinked
      ? "🧍 Linked identity"
      : "⚠️ Not linked";
  const identityBadgeTitle = identityUnavailable
    ? "Identity unavailable right now. Try refreshing later."
    : identityLinked
      ? "This employee is linked to a person identity. Identifiers are read-only."
      : "No linked identity yet. Add phone or email elsewhere to link when ready.";

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
          <Button asChild size="sm" variant="outline">
            <Link href={`${basePath}/edit`}>Edit</Link>
          </Button>
        </div>
      </div>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Employment</h2>
            <p className="text-sm text-muted-foreground">House-scoped job details for this worker.</p>
          </div>
          <Badge tone={employee.status === "active" ? "on" : "off"} className="uppercase">
            {employee.status}
          </Badge>
        </div>
        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Employee code</dt>
            <dd className="text-base font-medium text-foreground">{employee.code}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd className="text-base font-medium text-foreground">{employee.status === "active" ? "Active" : "Inactive"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Position/Role</dt>
            <dd className="text-base font-medium text-foreground">{employee.position_title ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Branch</dt>
            <dd className="text-base font-medium text-foreground">{branchName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Rate per day</dt>
            <dd className="text-base font-medium text-foreground">{formatCurrency(employee.rate_per_day)}</dd>
          </div>
          {employee.created_at ? (
            <div>
              <dt className="text-sm text-muted-foreground">Hire date</dt>
              <dd className="text-base font-medium text-foreground">{formatDate(employee.created_at)}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Identity</h2>
            <p className="text-sm text-muted-foreground">
              Linked person record with masked identifiers for lookup-first HR flows.
            </p>
          </div>
          <Badge
            tone={identityBadgeTone}
            className="gap-1"
            title={identityBadgeTitle}
          >
            {identityBadgeLabel}
          </Badge>
        </div>

        <dl className="grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Linked entity</dt>
            <dd className="text-base font-medium text-foreground">
              {identityUnavailable
                ? "Identity unavailable right now"
                : identityLinked
                  ? identity?.displayName || employee.full_name
                  : "Not linked"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Email(s)</dt>
            <dd className="space-y-1 text-sm text-foreground">
              {identityUnavailable ? (
                <span className="text-muted-foreground">Identity unavailable. Refresh or try again later.</span>
              ) : !identityLinked ? (
                <span className="text-muted-foreground">Not linked</span>
              ) : emailIdentifiers.length === 0 ? (
                <span className="text-muted-foreground">No email on record.</span>
              ) : (
                emailIdentifiers.map((email) => (
                  <div key={`${email.type}-${email.value_masked}`} className="flex items-center gap-2">
                    <span className="font-medium">{email.value_masked}</span>
                    {email.is_primary ? (
                      <Badge className="border-border bg-muted/60 text-xs font-normal">Primary</Badge>
                    ) : null}
                  </div>
                ))
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Phone(s)</dt>
            <dd className="space-y-1 text-sm text-foreground">
              {identityUnavailable ? (
                <span className="text-muted-foreground">Identity unavailable. Refresh or try again later.</span>
              ) : !identityLinked ? (
                <span className="text-muted-foreground">Not linked</span>
              ) : phoneIdentifiers.length === 0 ? (
                <span className="text-muted-foreground">No phone on record.</span>
              ) : (
                phoneIdentifiers.map((phone) => (
                  <div key={`${phone.type}-${phone.value_masked}`} className="flex items-center gap-2">
                    <span className="font-medium">{phone.value_masked}</span>
                    {phone.is_primary ? (
                      <Badge className="border-border bg-muted/60 text-xs font-normal">Primary</Badge>
                    ) : null}
                  </div>
                ))
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Notes</dt>
            <dd className="text-sm text-muted-foreground">
              {identityUnavailable
                ? "Identity is temporarily unavailable. Refresh or retry after the identity service recovers."
                : "Identity is read-only here. Manage linkage via the employee creation and lookup-first flows."}
            </dd>
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
