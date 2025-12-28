import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  listDepartmentIdsForHouse,
  listEmployeesForHouse,
  type EmployeeListItem,
} from "@/lib/hr/employees-server";
import {
  fetchIdentitySummary,
  type HrIdentitySummaryEntry,
  type HrIdentitySummaryMap,
} from "@/lib/hr/identity-summary";
import { getServiceSupabase } from "@/lib/supabase-service";

type Props = { params: Promise<{ slug: string }> };

function renderIdentity(
  employee: EmployeeListItem,
  summary: HrIdentitySummaryMap,
  identityUnavailable: boolean,
) {
  const entries = employee.entity_id ? summary[employee.entity_id] ?? [] : [];

  if (!employee.entity_id) {
    return <Badge tone="off">Unlinked</Badge>;
  }

  if (identityUnavailable) {
    return (
      <div className="space-y-1">
        <Badge tone="on">Linked</Badge>
        <p className="text-xs text-muted-foreground">Identity unavailable right now.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return <Badge tone="off">Linked; no identifiers</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry: HrIdentitySummaryEntry, index: number) => (
        <Badge key={`${employee.id}-${entry.identifierType}-${index}`} tone="on">
          {entry.identifierType}: {entry.maskedValue}
          {entry.isPrimary ? " • Primary" : ""}
        </Badge>
      ))}
    </div>
  );
}

export default async function HrEmployeesPage({ params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/employees`;

  const { supabase } = await requireAuth(basePath);
  const { data: house, error: houseError } = await supabase
    .from("houses")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (houseError) {
    console.warn("Failed to load HR house context", houseError);
  }

  const houseId = (house as { id?: string | null } | null)?.id;
  if (!houseId) {
    notFound();
  }

  const service = getServiceSupabase();

  let departmentIds: string[] = [];
  try {
    departmentIds = await listDepartmentIdsForHouse(service, houseId);
  } catch (error) {
    console.warn("Failed to load HR departments", error);
  }

  let employees: EmployeeListItem[] = [];
  if (departmentIds.length > 0) {
    try {
      employees = await listEmployeesForHouse(service, departmentIds);
    } catch (error) {
      console.warn("Failed to load HR employees", error);
    }
  }

  const entityIds = employees.map((emp) => emp.entity_id).filter(Boolean);
  let identitySummary: HrIdentitySummaryMap = {};
  let identityUnavailable = false;

  if (entityIds.length > 0) {
    try {
      identitySummary = await fetchIdentitySummary(service, houseId, entityIds);
    } catch (error) {
      console.warn("HR identity summary unavailable", error);
      identityUnavailable = true;
    }
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">Employees</h2>
        <p className="text-sm text-muted-foreground">
          Linked identities with masked contact details for this workspace.
        </p>
      </header>

      {identityUnavailable ? (
        <div className="rounded-lg border border-dashed border-border bg-white/60 px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Identity unavailable right now. We logged the issue—please retry shortly.
        </div>
      ) : null}

      <Card className="p-4">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">No employees found for this workspace.</p>
        ) : (
          <div className="space-y-3">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex flex-col gap-2 rounded-lg border border-border/70 bg-white/50 p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{employee.full_name}</p>
                    {employee.code ? (
                      <Badge tone="off" className="text-[11px]">{`#${employee.code}`}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Status: {employee.status ?? "active"}
                    {employee.rate_per_day != null ? ` • Rate/Day: ₱${employee.rate_per_day}` : ""}
                  </p>
                </div>
                <div className="lg:text-right">
                  <p className="text-xs font-medium text-muted-foreground">Identity</p>
                  <div className="mt-1">{renderIdentity(employee, identitySummary, identityUnavailable)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
