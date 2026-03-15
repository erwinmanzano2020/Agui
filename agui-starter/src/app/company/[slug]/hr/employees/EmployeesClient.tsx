"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { BranchListItem, EmployeeListItem } from "@/lib/hr/employees-server";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

type Filters = {
  status: string;
  branchId: string | null;
  search: string;
};

type Props = {
  basePath: string;
  employees: EmployeeListItem[];
  branches: BranchListItem[];
  branchLoadError?: string;
  employeeLoadError?: string;
  initialFilters: Filters;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(
    amount,
  );
}

function splitIdentityIdentifiers(identity: EmployeeListItem["identity"] | null | undefined) {
  const identifiers = identity?.identifiers ?? [];
  const emails = identifiers.filter((identifier) => identifier.type === "EMAIL");
  const phones = identifiers.filter((identifier) => identifier.type === "PHONE");
  return { emails, phones };
}

export function EmployeesClient({
  basePath,
  employees,
  branches,
  branchLoadError,
  employeeLoadError,
  initialFilters,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initialFilters.search);

  useEffect(() => {
    setSearch(initialFilters.search);
  }, [initialFilters.search]);

  const branchOptions = useMemo(() => [{ id: "", name: "All branches" }, ...branches], [branches]);

  const applyFilters = (next: Partial<Filters>) => {
    const params = new URLSearchParams(searchParams ?? undefined);
    const status = next.status ?? initialFilters.status;
    const branchId = next.branchId ?? initialFilters.branchId;
    const searchTerm = next.search ?? search;

    if (status && status !== "active") {
      params.set("status", status);
    } else {
      params.delete("status");
    }

    if (branchId) {
      params.set("branch", branchId);
    } else {
      params.delete("branch");
    }

    if (searchTerm.trim()) {
      params.set("q", searchTerm.trim());
    } else {
      params.delete("q");
    }

    const target = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    startTransition(() => {
      router.replace(target, { scroll: false });
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Employees</h1>
          <p className="text-sm text-muted-foreground">People within this house. Filter by status or branch.</p>
        </div>
        <Button asChild disabled={pending}>
          <Link href={`${basePath}/new`}>Add Employee</Link>
        </Button>
      </header>

      <Card className="space-y-4 p-4">
        {employeeLoadError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Employees cannot be loaded right now. {employeeLoadError}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex flex-col gap-1 text-sm text-muted-foreground">
              Status
              <select
                className="min-w-[140px] rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm"
                defaultValue={initialFilters.status}
                onChange={(e) => applyFilters({ status: e.target.value })}
                disabled={pending}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-muted-foreground">
              Branch
              <select
                className="min-w-[160px] rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm"
                defaultValue={initialFilters.branchId ?? ""}
                onChange={(e) => applyFilters({ branchId: e.target.value || null })}
                disabled={pending || Boolean(branchLoadError)}
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id || "all"} value={branch.id}>
                    {branch.name || "All branches"}
                  </option>
                ))}
              </select>
              {branchLoadError ? (
                <span className="text-xs text-destructive">Unable to load branches right now.</span>
              ) : null}
            </label>
          </div>

          <form
            className="flex w-full gap-2 md:w-auto md:min-w-[280px]"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters({ search });
            }}
          >
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code"
              disabled={pending}
            />
            <Button type="submit" disabled={pending}>
              Search
            </Button>
          </form>
        </div>

        <div className="overflow-x-auto">
          {employees.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              No employees found for this house.
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Code</th>
                  <th className="p-2 font-medium">Branch</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Identity</th>
                  <th className="p-2 font-medium">Rate / Day</th>
                  <th className="p-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="cursor-pointer border-t border-border/50 hover:bg-muted/30"
                    onClick={() => router.push(`${pathname}/${employee.id}`)}
                  >
                    <td className="p-2">{employee.full_name}</td>
                    <td className="p-2 text-muted-foreground">{employee.code}</td>
                    <td className="p-2">{employee.branch_name ?? "—"}</td>
                    <td className="p-2">
                      <Badge tone={employee.status === "active" ? "on" : "off"}>{employee.status}</Badge>
                    </td>
                    <td className="p-2">
                      {(() => {
                        const isLinked = Boolean(employee.entity_id);
                        const identityUnavailable = employee.identity_unavailable === true;
                        const { emails, phones } = splitIdentityIdentifiers(employee.identity);
                        const emailLabel = emails[0]?.value_masked ?? null;
                        const phoneLabel = phones[0]?.value_masked ?? null;

                        return (
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <Badge
                              tone={isLinked && !identityUnavailable ? "on" : "off"}
                              className="gap-1 border-border"
                              title={
                                identityUnavailable
                                  ? "Identity unavailable right now. Try refreshing or retry later."
                                  : isLinked
                                    ? "🧍 Linked identity: this employee is attached to a person record."
                                    : "⚠️ Not linked to a person identity yet."
                              }
                            >
                              {identityUnavailable
                                ? "⚠️ Identity unavailable"
                                : isLinked
                                  ? "🧍 Linked identity"
                                  : "⚠️ Not linked"}
                            </Badge>
                            {identityUnavailable ? (
                              <span className="text-muted-foreground">
                                Identity unavailable. Refresh or try again later.
                              </span>
                            ) : !isLinked ? (
                              <span className="text-muted-foreground">Not linked</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-muted-foreground">
                                  {emailLabel ? `Email: ${emailLabel}` : "No email on record"}
                                </div>
                                <div className="text-muted-foreground">
                                  {phoneLabel ? `Phone: ${phoneLabel}` : "No phone on record"}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-2">{formatCurrency(employee.rate_per_day)}</td>
                    <td className="p-2 text-right">
                      <Button asChild size="sm" variant="link" className="px-0"
                        onClick={(e: MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                        }}
                      >
                        <Link href={`${pathname}/${employee.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
