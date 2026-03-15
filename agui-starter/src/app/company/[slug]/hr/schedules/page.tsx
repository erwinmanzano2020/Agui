import { notFound } from "next/navigation";

import {
  addScheduleWindowAction,
  createBranchScheduleAssignmentAction,
  createScheduleTemplateAction,
  updateOvertimePolicyAction,
} from "./actions";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccess } from "@/lib/hr/access";
import type { HrScheduleWindowRow } from "@/lib/db.types";
import { listBranchesForHouse } from "@/lib/hr/employees-server";
import {
  getOvertimePolicyForHouse,
  OVERTIME_ROUNDING_MINUTES,
  OVERTIME_ROUNDING_MODES,
} from "@/lib/hr/overtime-policy-server";
import {
  getScheduleTemplateWithWindows,
  listBranchScheduleAssignments,
  listScheduleTemplates,
} from "@/lib/hr/schedules-server";

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function groupWindows(windows: HrScheduleWindowRow[]) {
  const map = new Map<number, HrScheduleWindowRow[]>();
  windows.forEach((window) => {
    const bucket = map.get(window.day_of_week) ?? [];
    bucket.push(window);
    map.set(window.day_of_week, bucket);
  });
  return map;
}

function formatWindow(window: HrScheduleWindowRow) {
  const breakLabel = window.break_start && window.break_end ? ` (break ${window.break_start}–${window.break_end})` : "";
  return `${window.start_time}–${window.end_time}${breakLabel}`;
}

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function HrSchedulesPage({ params }: Props) {
  const { slug } = await params;
  const basePath = `/company/${slug}/hr/schedules`;
  const { supabase } = await requireAuth(basePath);

  const { data: house } = await supabase
    .from("houses")
    .select("id, slug, name")
    .eq("slug", slug)
    .maybeSingle();

  if (!house) {
    notFound();
  }

  const access = await requireHrAccess(supabase, house.id);
  if (!access.allowed) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
        You do not have access to schedule definitions for this house.
      </div>
    );
  }

  const overtimePolicy = await getOvertimePolicyForHouse(supabase, house.id, { access });
  if (!overtimePolicy) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
        You do not have access to overtime policy settings for this house.
      </div>
    );
  }

  const templates = await listScheduleTemplates(supabase, house.id, { access });
  const templateDetails = await Promise.all(
    templates.map((template) =>
      getScheduleTemplateWithWindows(supabase, house.id, template.id, { access }),
    ),
  );
  const templateWindows = new Map(
    templateDetails
      .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
      .map((detail) => [detail.template.id, detail.windows]),
  );

  const branchResult = await listBranchesForHouse(supabase, house.id);
  const assignments = await listBranchScheduleAssignments(supabase, house.id, undefined, { access });
  const assignmentsByBranch = new Map<string, typeof assignments>();
  assignments.forEach((assignment) => {
    const bucket = assignmentsByBranch.get(assignment.branch_id) ?? [];
    bucket.push(assignment);
    assignmentsByBranch.set(assignment.branch_id, bucket);
  });

  const scheduleNameById = new Map(templates.map((template) => [template.id, template.name]));

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Schedule templates</h2>
          <p className="text-sm text-muted-foreground">
            Define the standard work windows for each team. This page stores schedule definitions only — no overtime,
            grace, or auto-close logic is applied yet.
          </p>
        </div>
        <form action={createScheduleTemplateAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="houseId" value={house.id} />
          <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Template name
            <input
              type="text"
              name="name"
              placeholder="Opening Team"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Timezone
            <input
              type="text"
              name="timezone"
              defaultValue="Asia/Manila"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Day of week
            <select
              name="dayOfWeek"
              defaultValue="1"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {DAY_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Start time
            <input
              type="time"
              name="startTime"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            End time
            <input
              type="time"
              name="endTime"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Break start (optional)
            <input
              type="time"
              name="breakStart"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Break end (optional)
            <input
              type="time"
              name="breakEnd"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Create template
            </button>
          </div>
        </form>
      </section>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
          No schedule templates yet. Create your first template to start assigning schedules.
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => {
            const windows = templateWindows.get(template.id) ?? [];
            const windowsByDay = groupWindows(windows);
            return (
              <section key={template.id} className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{template.name}</h3>
                    <p className="text-xs text-muted-foreground">Timezone: {template.timezone}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{windows.length} window(s) defined</p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {DAY_LABELS.map((label, index) => {
                    const dayWindows = windowsByDay.get(index) ?? [];
                    return (
                      <div key={label} className="rounded-xl border border-border/70 bg-background/70 p-3">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        {dayWindows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No windows</p>
                        ) : (
                          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                            {dayWindows.map((window) => (
                              <li key={window.id}>{formatWindow(window)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>

                <form action={addScheduleWindowAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="houseId" value={house.id} />
                  <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
                  <input type="hidden" name="scheduleId" value={template.id} />
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    Day
                    <select
                      name="dayOfWeek"
                      defaultValue="1"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    >
                      {DAY_LABELS.map((label, index) => (
                        <option key={`${template.id}-${label}`} value={index}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    Start
                    <input
                      type="time"
                      name="startTime"
                      required
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    End
                    <input
                      type="time"
                      name="endTime"
                      required
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    Break start
                    <input
                      type="time"
                      name="breakStart"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                    Break end
                    <input
                      type="time"
                      name="breakEnd"
                      className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground"
                  >
                    Add window
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Overtime policy</h2>
          <p className="text-sm text-muted-foreground">
            Configure the minimum overtime threshold and rounding rules for this house. Timezone is locked to
            Asia/Manila for now.
          </p>
        </div>
        <form action={updateOvertimePolicyAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="houseId" value={house.id} />
          <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
          <input type="hidden" name="timezone" value={overtimePolicy.timezone} />
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Minimum OT minutes
            <input
              type="number"
              name="minOtMinutes"
              min={0}
              max={240}
              defaultValue={overtimePolicy.min_ot_minutes}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Rounding mode
            <select
              name="roundingMode"
              defaultValue={overtimePolicy.rounding_mode}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {OVERTIME_ROUNDING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Rounding minutes
            <select
              name="roundingMinutes"
              defaultValue={overtimePolicy.rounding_minutes}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {OVERTIME_ROUNDING_MINUTES.map((value) => (
                <option key={value} value={value}>
                  {value} minute{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            Timezone
            <input
              type="text"
              name="timezoneDisplay"
              value={overtimePolicy.timezone}
              disabled
              className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Save overtime policy
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Branch assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign a schedule template to each branch with an effective date. Historical changes are preserved.
          </p>
        </div>

        {branchResult.error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            Failed to load branches: {branchResult.error}
          </div>
        ) : null}

        {branchResult.branches.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-white/60 p-4 text-sm text-muted-foreground">
            No branches found for this house.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {branchResult.branches.map((branch) => {
              const history = assignmentsByBranch.get(branch.id) ?? [];
              return (
                <div key={branch.id} className="rounded-xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground">{branch.name}</h3>
                    <span className="text-xs text-muted-foreground">{history.length} assignment(s)</span>
                  </div>
                  <form action={createBranchScheduleAssignmentAction} className="mt-3 flex flex-wrap items-end gap-3">
                    <input type="hidden" name="houseId" value={house.id} />
                    <input type="hidden" name="houseSlug" value={house.slug ?? slug} />
                    <input type="hidden" name="branchId" value={branch.id} />
                    <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                      Schedule
                      <select
                        name="scheduleId"
                        required
                        className="min-w-[200px] rounded-md border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="">Select template</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-foreground">
                      Effective from
                      <input
                        type="date"
                        name="effectiveFrom"
                        required
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground"
                    >
                      Assign
                    </button>
                  </form>
                  {history.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">No schedule history yet.</p>
                  ) : (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {history.map((item) => (
                        <li key={item.id}>
                          {item.effective_from}: {scheduleNameById.get(item.schedule_id) ?? item.schedule_id}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
