import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/require-auth";
import { getEmployeeByIdForHouse } from "@/lib/hr/employees-server";

type Props = { params: Promise<{ slug: string; id: string }> };


declare module "react" {
  interface ButtonHTMLAttributes<_T> {
    command?: string;
    commandFor?: string;
  }
}

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
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <Link href={`/company/${slug}/hr/employees`} className="underline">
            Employees
          </Link>
        </div>
        <Card className="p-4 sm:p-5 lg:p-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
            {employee.photo_url ? (
              <>
                <button
                  type="button"
                  command="show-modal"
                  commandFor="employee-photo-preview"
                  className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Preview ${employee.full_name} photo`}
                >
                  <img
                    src={employee.photo_url}
                    alt={`${employee.full_name} photo`}
                    className="h-28 w-28 shrink-0 rounded-xl border border-border object-cover sm:h-24 sm:w-24 lg:h-20 lg:w-20"
                  />
                </button>
                <dialog
                  id="employee-photo-preview"
                  className="m-auto w-[min(92vw,420px)] rounded-xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/70"
                  aria-label={`${employee.full_name} photo preview`}
                >
                  <div className="space-y-3 p-3">
                    <div className="flex justify-end">
                      <form method="dialog">
                        <Button type="submit" variant="outline" size="sm" aria-label="Close photo preview">
                          Close
                        </Button>
                      </form>
                    </div>
                    <img
                      src={employee.photo_url}
                      alt={`${employee.full_name} full-size photo`}
                      className="h-auto max-h-[80vh] w-full rounded-md object-contain"
                    />
                  </div>
                </dialog>
              </>
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-xs text-muted-foreground sm:h-24 sm:w-24 lg:h-20 lg:w-20">
                No photo
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{employee.full_name}</h1>
                <p className="text-sm text-muted-foreground">Code: {employee.code}</p>
                <p className="text-sm text-muted-foreground">
                  {employee.position_title ?? "No role assigned"} • {branchName}
                </p>
                <div className="flex justify-center sm:justify-start">
                  <Badge tone={employee.status === "active" ? "on" : "off"} className="uppercase">
                    {employee.status}
                  </Badge>
                </div>
              </div>

              <div className="grid w-full gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button asChild className="h-11 sm:h-10">
                  <Link href={`${basePath}/edit`}>Edit Employee</Link>
                </Button>
                <Button asChild variant="outline" className="h-11 sm:h-10">
                  <Link href={`/api/hr/employees/${employee.id}/id-card.pdf?houseId=${house.id}&format=cr80`} target="_blank">
                    Print ID
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Employment</h2>
            <p className="text-sm text-muted-foreground">House-scoped job details for this worker.</p>
          </div>
          <Badge tone={employee.status === "active" ? "on" : "off"} className="uppercase">
            {employee.status}
          </Badge>
        </div>
        <dl className="grid gap-4 sm:gap-5 md:grid-cols-2">
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

      <Card className="space-y-4 p-4 sm:p-5">
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

        <dl className="grid gap-4 sm:gap-5 md:grid-cols-2">
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

      <Card className="space-y-3 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Quick links</h2>
          <p className="text-sm text-muted-foreground">Shortcuts coming soon.</p>
        </div>
        <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
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
