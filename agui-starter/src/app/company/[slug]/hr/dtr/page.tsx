import { notFound } from "next/navigation";

import {
  CorrectionDtrFactForm,
  CreateDtrSegmentForm,
  RemediationDtrForm,
} from "./DtrSegmentForms";
import {
  applyCanonicalEmployeeFilter,
  canCaptureCurrentEmployee,
  canCorrectCanonicalFact,
  canonicalEmployeeIds,
  groupCanonicalAttendance,
} from "./view-model";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
import { listCanonicalAttendanceForDate } from "@/lib/hr/attendance-p1-server";
import {
  listBranchesForHouse,
  listEmployeeDisplayMetadataForHouseByIds,
  listEmployeesByHouse,
} from "@/lib/hr/employees-server";
import { formatManilaTimeFromIso, toManilaDate } from "@/lib/hr/timezone";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value: string | undefined, fallback: string) {
  if (value && DATE_REGEX.test(value)) return value;
  return fallback;
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

  const [readAccess, writeAccess] = await Promise.all([
    requireHrAccessWithBranch(supabase, {
      houseId: house.id,
      requiredLevel: "read",
    }),
    requireHrAccessWithBranch(supabase, {
      houseId: house.id,
      requiredLevel: "write",
      writeScope: "branch-set-preflight",
    }),
  ]);

  const today = toManilaDate(new Date()) ?? new Date().toISOString().slice(0, 10);
  const dateParam = typeof rawSearch.date === "string" ? rawSearch.date : undefined;
  const workDate = normalizeDate(dateParam, today);
  const isCurrentBusinessDate = workDate === today;
  const isPastBusinessDate = workDate < today;
  const isFutureBusinessDate = workDate > today;
  const requestedEmployeeFilter =
    typeof rawSearch.employee === "string" ? rawSearch.employee : "";

  const canonicalFacts = readAccess.allowed
    ? await listCanonicalAttendanceForDate(
        supabase,
        house.id,
        workDate,
        readAccess,
      )
    : [];

  const allVisibleEmployeeIds = canonicalEmployeeIds(canonicalFacts);
  const employeeMetadata = await listEmployeeDisplayMetadataForHouseByIds(
    supabase,
    house.id,
    allVisibleEmployeeIds,
  );
  const employeeMetadataById = new Map(
    employeeMetadata.map((employee) => [employee.id, employee]),
  );

  const {
    rows: filteredCanonicalFacts,
    selectedEmployeeId,
  } = applyCanonicalEmployeeFilter(canonicalFacts, requestedEmployeeFilter);

  const canonicalFactsByEmployee = groupCanonicalAttendance(filteredCanonicalFacts);
  const resultEmployeeIds = canonicalEmployeeIds(filteredCanonicalFacts);

  const [branchResult, captureEmployeesResult, remediationEmployeesResult] =
    await Promise.all([
      writeAccess.allowed
        ? listBranchesForHouse(supabase, house.id, writeAccess)
        : Promise.resolve({ branches: [] }),
      isCurrentBusinessDate && writeAccess.allowed
        ? listEmployeesByHouse(
            supabase,
            house.id,
            { status: "active" },
            { readScope: writeAccess },
          )
        : Promise.resolve({ employees: [] }),
      isPastBusinessDate && writeAccess.allowed && !writeAccess.isBranchLimited
        ? listEmployeesByHouse(
            supabase,
            house.id,
            { status: "all" },
          )
        : Promise.resolve({ employees: [] }),
    ]);

  const attendanceBranches = branchResult.branches;
  const captureEmployees = captureEmployeesResult.employees.filter((employee) =>
    canCaptureCurrentEmployee(employee, writeAccess),
  );
  const remediationEmployees = remediationEmployeesResult.employees;
  const canShowCurrentCapture =
    isCurrentBusinessDate &&
    writeAccess.allowed &&
    attendanceBranches.length > 0 &&
    captureEmployees.length > 0;
  const canShowHistoricalRemediation =
    isPastBusinessDate &&
    writeAccess.allowed &&
    !writeAccess.isBranchLimited &&
    attendanceBranches.length > 0 &&
    remediationEmployees.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-white/70 p-6 shadow-sm">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Daily DTR</h2>
          <p className="text-sm text-muted-foreground">
            Attendance results are canonical facts visible to your current HR read scope.
            Current employee assignment and compatibility rows are not used as historical
            attendance authority.
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
            Visible employee (optional)
            <select
              name="employee"
              defaultValue={selectedEmployeeId}
              className="min-w-[240px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All visible facts</option>
              {allVisibleEmployeeIds.map((employeeId) => {
                const employee = employeeMetadataById.get(employeeId);
                return (
                  <option key={employeeId} value={employeeId}>
                    {employee
                      ? `${employee.full_name} · ${employee.code}`
                      : "Employee details unavailable"}
                  </option>
                );
              })}
            </select>
          </label>

          <button
            type="submit"
            className="rounded-lg border border-border bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Load
          </button>
        </form>

        {isPastBusinessDate ? (
          <p className="mt-3 text-xs text-amber-700">
            Historical date selected. Existing visible facts may be corrected when your
            write authority permits it. Missing historical attendance uses the separate
            owner/manager remediation workflow below.
          </p>
        ) : null}

        {isFutureBusinessDate ? (
          <p className="mt-3 text-xs text-amber-700">
            Future date selected. Ordinary attendance creation and historical remediation
            are unavailable.
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Canonical attendance
            </h3>
            <p className="text-xs text-muted-foreground">
              {filteredCanonicalFacts.length} visible fact
              {filteredCanonicalFacts.length === 1 ? "" : "s"} for {workDate}.
            </p>
          </div>
        </div>

        {resultEmployeeIds.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-white/60 p-6 text-sm text-muted-foreground">
            No canonical attendance facts are visible for this date and filter.
          </div>
        ) : (
          <div className="space-y-4">
            {resultEmployeeIds.map((employeeId) => {
              const employee = employeeMetadataById.get(employeeId);
              const facts = canonicalFactsByEmployee.get(employeeId) ?? [];

              return (
                <section
                  key={employeeId}
                  className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">
                        {employee?.full_name ?? "Employee details unavailable"}
                      </h4>
                      {employee ? (
                        <p className="text-xs text-muted-foreground">
                          Employee ID: {employee.code}
                          {employee.status !== "active"
                            ? ` · ${employee.status}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Canonical facts: {facts.length}
                    </div>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {facts.map((fact) => {
                      const canCorrect = canCorrectCanonicalFact(
                        fact,
                        writeAccess,
                      );

                      return (
                        <li
                          key={fact.fact_id}
                          className="rounded-xl border border-border/70 bg-background/70 p-3"
                        >
                          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">
                                Time in
                              </div>
                              <div className="font-medium text-foreground">
                                {formatManilaTimeFromIso(fact.time_in)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">
                                Time out
                              </div>
                              <div className="font-medium text-foreground">
                                {formatManilaTimeFromIso(fact.time_out)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">
                                Status
                              </div>
                              <div className="font-medium text-foreground">
                                {fact.status || "—"}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] uppercase text-muted-foreground">
                                Attribution
                              </div>
                              <div className="font-medium text-foreground">
                                {fact.attribution_state}
                              </div>
                            </div>
                          </div>

                          {canCorrect ? (
                            <CorrectionDtrFactForm
                              houseId={house.id}
                              houseSlug={house.slug ?? slug}
                              fact={fact}
                              branches={attendanceBranches}
                              canChangeLocation={!writeAccess.isBranchLimited}
                            />
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Read-only for your current write authority.
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {canShowCurrentCapture ? (
        <section className="rounded-2xl border border-border bg-white/70 p-5 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Same-day manual capture
            </h3>
            <p className="text-xs text-muted-foreground">
              This is a current operational write workflow, not a list of missing DTR
              records. Targets are based on your current HR write scope; the canonical
              attendance result appears only after a successful canonical commit.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {captureEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-xl border border-border/70 bg-background/70 p-3"
              >
                <div className="mb-2">
                  <div className="text-sm font-medium text-foreground">
                    {employee.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Employee ID: {employee.code}
                  </div>
                </div>
                <CreateDtrSegmentForm
                  houseId={house.id}
                  houseSlug={house.slug ?? slug}
                  workDate={workDate}
                  employeeId={employee.id}
                  branches={attendanceBranches}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {canShowHistoricalRemediation ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Owner/manager historical missing-attendance review
            </h3>
            <p className="text-xs text-muted-foreground">
              This separate remediation workflow does not infer absence from the canonical
              result list. Candidate resolution and adjudication remain authoritative.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            {remediationEmployees.map((employee) => (
              <div
                key={employee.id}
                className="rounded-xl border border-amber-200 bg-white/70 p-3"
              >
                <div className="mb-2">
                  <div className="text-sm font-medium text-foreground">
                    {employee.full_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Employee ID: {employee.code}
                    {employee.status !== "active"
                      ? ` · ${employee.status}`
                      : ""}
                  </div>
                </div>
                <RemediationDtrForm
                  houseId={house.id}
                  houseSlug={house.slug ?? slug}
                  workDate={workDate}
                  employeeId={employee.id}
                  branches={attendanceBranches}
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {captureEmployeesResult.error || remediationEmployeesResult.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          An employee workflow list could not be loaded. Attendance results above remain
          canonical and unaffected.
        </div>
      ) : null}
    </div>
  );
}
