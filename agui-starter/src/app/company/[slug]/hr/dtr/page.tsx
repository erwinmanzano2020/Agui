import { notFound } from "next/navigation";

import { createDtrSegmentAction, updateDtrSegmentAction } from "./actions";
import { requireAuth } from "@/lib/auth/require-auth";
import type { DtrSegmentRow } from "@/lib/db.types";
import { listDtrByHouseAndDate } from "@/lib/hr/dtr-segments-server";
import { listEmployeesByHouse } from "@/lib/hr/employees-server";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | undefined, fallback: string) {
  if (value && DATE_REGEX.test(value)) return value;
  return fallback;
}

function formatTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(11, 16);
}

function groupSegments(segments: DtrSegmentRow[]) {
  const map = new Map<string, DtrSegmentRow[]>();
  segments.forEach((segment) => {
    const bucket = map.get(segment.employee_id) ?? [];
    bucket.push(segment);
    map.set(segment.employee_id, bucket);
  });
  return map;
}

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HrDtrPage({ params, searchParams }: Props) {
  const [paramsValue, rawSearchValue] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);
  const { slug } = paramsValue;
  const rawSearch = rawSearchValue as Record<string, string | string[] | undefined>;
  const basePath = `/company/${slug}/hr/dtr`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);
  const dateParam = typeof rawSearch.date === "string" ? rawSearch.date : undefined;
  const workDate = normalizeDate(dateParam, today);

  const employeeFilter = typeof rawSearch.employee === "string" ? rawSearch.employee : "";

  const employeesResult = await listEmployeesByHouse(supabase, house.id, { status: "active" });
  const employees = employeesResult.employees;
  const allowedEmployeeIds = new Set(employees.map((employee) => employee.id));
  const filteredEmployeeId = allowedEmployeeIds.has(employeeFilter) ? employeeFilter : "";

  const segments = await listDtrByHouseAndDate(supabase, house.id, workDate, {
    employeeId: filteredEmployeeId || undefined,
  });
  const segmentsByEmployee = groupSegments(segments);

  const visibleEmployees = filteredEmployeeId
    ? employees.filter((employee) => employee.id === filteredEmployeeId)
    : employees;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Daily DTR</h2>
          <p className="text-sm text-muted-foreground">
            Multiple segments per day are allowed. This view captures raw attendance only — no schedule or overtime logic
            is applied yet.
          </p>
        </div>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Date
            <input
              type="date"
              name="date"
              defaultValue={workDate}
              className="w-44 rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Employee (optional)
            <select
              name="employee"
              defaultValue={filteredEmployeeId}
              className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Load
          </button>
        </form>
      </section>

      {employeesResult.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Failed to load employees: {employeesResult.error}
        </div>
      ) : null}

      {visibleEmployees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          No active employees found for this house.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleEmployees.map((employee) => {
            const employeeSegments = segmentsByEmployee.get(employee.id) ?? [];
            return (
              <section key={employee.id} className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{employee.full_name}</h3>
                    <p className="text-xs text-muted-foreground">Employee ID: {employee.code}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Segments: {employeeSegments.length} for {workDate}
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {employeeSegments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No segments recorded for this employee yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {employeeSegments.map((segment) => (
                        <li
                          key={segment.id}
                          className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm"
                        >
                          <form action={updateDtrSegmentAction} className="flex flex-wrap items-center gap-3">
                            <input type="hidden" name="houseId" value={house.id} />
                            <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
                            <input type="hidden" name="segmentId" value={segment.id} />
                            <input type="hidden" name="workDate" value={workDate} />
                            <label className="flex flex-col text-xs text-muted-foreground">
                              Time in
                              <input
                                type="time"
                                name="timeIn"
                                defaultValue={formatTimeInput(segment.time_in)}
                                required
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                              />
                            </label>
                            <label className="flex flex-col text-xs text-muted-foreground">
                              Time out
                              <input
                                type="time"
                                name="timeOut"
                                defaultValue={formatTimeInput(segment.time_out)}
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                              />
                            </label>
                            <span className="text-xs text-muted-foreground">
                              Status: {segment.status}
                            </span>
                            <button
                              type="submit"
                              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground"
                            >
                              Save
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <form action={createDtrSegmentAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="houseId" value={house.id} />
                  <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
                  <input type="hidden" name="employeeId" value={employee.id} />
                  <input type="hidden" name="workDate" value={workDate} />
                  <label className="flex flex-col text-xs text-muted-foreground">
                    Time in
                    <input
                      type="time"
                      name="timeIn"
                      required
                      defaultValue="09:00"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col text-xs text-muted-foreground">
                    Time out (optional)
                    <input
                      type="time"
                      name="timeOut"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-border bg-foreground px-4 py-2 text-xs font-semibold text-background"
                  >
                    Add segment
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
