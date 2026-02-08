import { notFound } from "next/navigation";

import { createDtrSegmentAction, updateDtrSegmentAction } from "./actions";
import { requireAuth } from "@/lib/auth/require-auth";
import type { DtrSegmentRow } from "@/lib/db.types";
import { listDtrByHouseAndDate } from "@/lib/hr/dtr-segments-server";
import { listEmployeesByHouse } from "@/lib/hr/employees-server";
import { computeOvertimeForHouseDate, getScheduleForEmployeeOnDate } from "@/lib/hr/overtime-engine";
import { formatManilaTimeForUi, formatManilaTimeFromIso } from "@/lib/hr/timezone";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | undefined, fallback: string) {
  if (value && DATE_REGEX.test(value)) return value;
  return fallback;
}

function formatTimeInput(value: string | null) {
  return formatManilaTimeForUi(value);
}

function diffMinutesFromIso(start?: string | null, end?: string | null) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  if (endDate.getTime() <= startDate.getTime()) return 0;
  return Math.floor((endDate.getTime() - startDate.getTime()) / 60000);
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

  const overtimeResults = await computeOvertimeForHouseDate(supabase, {
    houseId: house.id,
    workDate,
    employeeIds: visibleEmployees.map((employee) => employee.id),
  });
  const overtimeByEmployee = new Map(
    overtimeResults.map((result) => [result.employeeId, result]),
  );

  const scheduleResults = await Promise.all(
    visibleEmployees.map(async (employee) => ({
      employeeId: employee.id,
      schedule: await getScheduleForEmployeeOnDate(supabase, {
        houseId: house.id,
        employeeId: employee.id,
        workDate,
      }),
    })),
  );
  const scheduleByEmployee = new Map(
    scheduleResults.map((result) => [result.employeeId, result.schedule]),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Daily DTR</h2>
          <p className="text-sm text-muted-foreground">
            Multiple segments per day are allowed. This view captures raw attendance and shows derived overtime minutes
            computed from schedules and house policy (read-only).
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
            const schedule = scheduleByEmployee.get(employee.id);
            const scheduleStart =
              schedule?.status === "ok" ? schedule.scheduledStartTs : null;
            const scheduleEnd =
              schedule?.status === "ok" ? schedule.scheduledEndTs : null;
            const lastOut = employeeSegments.filter((segment) => segment.time_out).slice(-1)[0]
              ?.time_out;
            const derivedOtMinutes = Math.max(0, diffMinutesFromIso(scheduleEnd, lastOut ?? null));
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
                <div className="mt-3 flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Overtime (mins, derived)</span>
                    {overtimeByEmployee.get(employee.id)?.scheduleStatus === "no_schedule" ? (
                      <span
                        className="text-sm font-semibold text-muted-foreground"
                        title="No schedule assigned"
                      >
                        —
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {overtimeByEmployee.get(employee.id)?.rawOtMinutes ?? 0}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Overtime (rounded)</span>
                    {overtimeByEmployee.get(employee.id)?.scheduleStatus === "no_schedule" ? (
                      <span
                        className="text-sm font-semibold text-muted-foreground"
                        title="No schedule assigned"
                      >
                        —
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {overtimeByEmployee.get(employee.id)?.finalOtMinutes ?? 0}
                      </span>
                    )}
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

                <details className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3 text-xs text-muted-foreground">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">Debug</summary>
                  <div className="mt-3 space-y-2">
                    <div className="grid gap-1 sm:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Schedule start</div>
                        <div>{formatManilaTimeFromIso(scheduleStart)}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground">Schedule end</div>
                        <div>{formatManilaTimeFromIso(scheduleEnd)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">Derived OT (mins)</div>
                      <div>
                        {derivedOtMinutes}{" "}
                        <span className="text-muted-foreground">
                          {lastOut && scheduleEnd
                            ? `(${formatManilaTimeFromIso(lastOut)} - ${formatManilaTimeFromIso(scheduleEnd)})`
                            : "(—)"}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {employeeSegments.map((segment) => (
                        <div key={`${segment.id}-debug`} className="rounded-lg border border-border/60 bg-background/80 p-2">
                          <div className="text-[11px] uppercase text-muted-foreground">Segment {segment.id}</div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">time_in</div>
                              <div className="font-mono text-[11px] text-foreground">{segment.time_in ?? "—"}</div>
                              <div className="text-[11px]">Manila: {formatManilaTimeFromIso(segment.time_in)}</div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">time_out</div>
                              <div className="font-mono text-[11px] text-foreground">{segment.time_out ?? "—"}</div>
                              <div className="text-[11px]">Manila: {formatManilaTimeFromIso(segment.time_out)}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

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
