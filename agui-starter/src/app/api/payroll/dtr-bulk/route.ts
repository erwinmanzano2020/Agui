import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const loadSchema = z.object({
  action: z.enum(["load"]),
  mode: z.enum(["single", "all"]),
  from: z.string(),
  to: z.string(),
  employeeId: z.string().optional(),
  employeeIds: z.string().array().optional(),
});

const dayCell = z.object({
  in1: z.string().optional().default(""),
  out1: z.string().optional().default(""),
  in2: z.string().optional().default(""),
  out2: z.string().optional().default(""),
});

const saveSchema = z.object({
  action: z.enum(["save"]),
  mode: z.enum(["single", "all"]),
  days: z.string().array(),
  employeeId: z.string().optional(),
  employeeIds: z.string().array().optional(),
  grid: z.record(z.record(dayCell)).default({}),
});

type DayCell = ReturnType<(typeof dayCell)["parse"]>;

type SegmentInsert = Pick<
  Database["public"]["Tables"]["dtr_segments"]["Insert"],
  "employee_id" | "work_date" | "start_at" | "end_at" | "company_id"
>;
type EntryUpsert = Pick<
  Database["public"]["Tables"]["dtr_entries"]["Insert"],
  "employee_id" | "work_date" | "time_in" | "time_out" | "company_id"
>;

function toISO(date: string, hhmm: string) {
  const m = hhmm.trim().match(/^(\d{1,2})(:?)(\d{0,2})$/);
  if (!m) return null;
  const hh = Math.min(23, parseInt(m[1] || "0", 10)).toString().padStart(2, "0");
  const mmRaw = m[3] ? parseInt(m[3], 10) : 0;
  const mm = Math.min(59, isNaN(mmRaw) ? 0 : mmRaw).toString().padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00`).toISOString();
}

async function resolveHouseForEntity(
  service: SupabaseClient<Database>,
  entityId: string,
  explicitHouseId?: string | null,
): Promise<string | null> {
  const requestedHouseId = explicitHouseId?.trim();
  if (requestedHouseId) {
    const { data, error } = await service
      .from("house_roles")
      .select("house_id")
      .eq("entity_id", entityId)
      .eq("house_id", requestedHouseId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? null) as { house_id?: string | null } | null)?.house_id ?? null;
  }

  const { data, error } = await service
    .from("house_roles")
    .select("house_id")
    .eq("entity_id", entityId)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ house_id?: string | null }>;
  return rows[0]?.house_id ?? null;
}

async function resolveDepartmentsForHouse(
  service: SupabaseClient<Database>,
  houseId: string,
): Promise<string[]> {
  const { data, error } = await service
    .from("branches")
    .select("id")
    .eq("house_id", houseId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => (row as { id?: string | null }).id)
    .filter((id): id is string => Boolean(id));
}

async function loadEmployeeDepartmentMap(
  service: SupabaseClient<Database>,
  employeeIds: string[],
  departmentIds: string[],
): Promise<Map<string, string | null>> {
  if (!employeeIds.length || !departmentIds.length) {
    return new Map();
  }

  const { data, error } = await service
    .from("employees")
    .select("id, department_id")
    .in("id", employeeIds)
    .in("department_id" as never, departmentIds)
    .returns<Array<{ id: string; department_id: string | null }>>();

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    if (row.id) {
      map.set(row.id, row.department_id ?? null);
    }
  }
  return map;
}

async function detectSupportedColumns(
  service: SupabaseClient<Database>,
  table: string,
  columns: string[],
): Promise<Set<string>> {
  const supported = new Set<string>();
  await Promise.all(
    columns.map(async (column) => {
      const { error } = await service.from(table).select(column).limit(0);
      if (!error) {
        supported.add(column);
      }
    }),
  );
  return supported;
}

function applyContextColumns(
  row: Record<string, unknown>,
  supported: Set<string>,
  context: { houseId: string; departmentId: string | null },
) {
  if (supported.has("department_id")) {
    row.department_id = context.departmentId;
  }
  if (supported.has("branch_id")) {
    row.branch_id = context.departmentId;
  }
  if (supported.has("house_id")) {
    row.house_id = context.houseId;
  }
  if (supported.has("company_id")) {
    row.company_id = context.houseId;
  }
}

export async function POST(req: NextRequest) {
  const guard = await requireAnyFeatureAccessApi([
    AppFeature.DTR_BULK,
    AppFeature.PAYROLL,
  ]);
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = getServiceSupabase();
  const url = new URL(req.url);

  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(user, service);
  } catch (error) {
    console.error("[/api/payroll/dtr-bulk] failed to resolve entity", error);
    return NextResponse.json({ error: "Failed to resolve account" }, { status: 500 });
  }

  if (!entityId) {
    return NextResponse.json({ error: "Account not linked" }, { status: 403 });
  }

  let houseId: string | null = null;
  try {
    houseId = await resolveHouseForEntity(service, entityId, url.searchParams.get("houseId"));
  } catch (error) {
    console.error("[/api/payroll/dtr-bulk] failed to resolve house", error);
    return NextResponse.json({ error: "Failed to resolve house" }, { status: 500 });
  }

  if (!houseId) {
    return NextResponse.json({ error: "No accessible house" }, { status: 403 });
  }

  let departmentIds: string[] = [];
  try {
    departmentIds = await resolveDepartmentsForHouse(service, houseId);
  } catch (error) {
    console.error("[/api/payroll/dtr-bulk] failed to resolve departments", error);
    return NextResponse.json({ error: "Failed to resolve house departments" }, { status: 500 });
  }

  if (!departmentIds.length) {
    return NextResponse.json({ error: "No accessible departments" }, { status: 403 });
  }

  const [segmentColumns, entryColumns] = await Promise.all([
    detectSupportedColumns(service, "dtr_segments", [
      "department_id",
      "branch_id",
      "house_id",
      "company_id",
    ]),
    detectSupportedColumns(service, "dtr_entries", [
      "department_id",
      "branch_id",
      "house_id",
      "company_id",
    ]),
  ]);

  try {
    if ((body as { action?: string }).action === "load") {
      const payload = loadSchema.parse(body);
      if (payload.mode === "single") {
        const employeeId = payload.employeeId;
        if (!employeeId) {
          return NextResponse.json(
            { error: "Missing employeeId for single mode" },
            { status: 400 },
          );
        }

        let departmentId: string | null = null;
        try {
          const map = await loadEmployeeDepartmentMap(service, [employeeId], departmentIds);
          departmentId = map.get(employeeId) ?? null;
        } catch (error) {
          console.error("[/api/payroll/dtr-bulk] failed to verify employee department", error);
          return NextResponse.json({ error: "Failed to resolve employee" }, { status: 500 });
        }

        if (!departmentId) {
          return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
        }

        const { data, error } = await service
          .from("dtr_segments")
          .select("employee_id, work_date, start_at, end_at")
          .eq("employee_id", employeeId)
          .gte("work_date", payload.from)
          .lte("work_date", payload.to)
          .order("work_date", { ascending: true })
          .order("start_at", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ segments: data ?? [] });
      }

      const ids = payload.employeeIds?.filter(Boolean) ?? [];
      if (!ids.length) {
        return NextResponse.json({ entries: [] });
      }

      let allowedIds = ids;
      try {
        const map = await loadEmployeeDepartmentMap(service, ids, departmentIds);
        allowedIds = ids.filter((id: string) => map.has(id));
      } catch (error) {
        console.error("[/api/payroll/dtr-bulk] failed to verify employees for load", error);
        return NextResponse.json({ error: "Failed to resolve employees" }, { status: 500 });
      }

      if (!allowedIds.length) {
        return NextResponse.json({ entries: [] });
      }

      const { data, error } = await service
        .from("dtr_entries")
        .select("employee_id, work_date, time_in, time_out")
        .in("employee_id", allowedIds)
        .gte("work_date", payload.from)
        .lte("work_date", payload.to);
      if (error) throw error;
      return NextResponse.json({ entries: data ?? [] });
    }

    if ((body as { action?: string }).action === "save") {
      const payload = saveSchema.parse(body);
      if (payload.mode === "single") {
        const employeeId = payload.employeeId;
        if (!employeeId) {
          return NextResponse.json(
            { error: "Missing employeeId for single mode" },
            { status: 400 },
          );
        }

        let departmentId: string | null = null;
        try {
          const map = await loadEmployeeDepartmentMap(service, [employeeId], departmentIds);
          departmentId = map.get(employeeId) ?? null;
        } catch (error) {
          console.error("[/api/payroll/dtr-bulk] failed to verify employee for save", error);
          return NextResponse.json({ error: "Failed to resolve employee" }, { status: 500 });
        }

        if (!departmentId) {
          return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
        }

        const perDay = payload.grid[employeeId] ?? {};
        for (const day of payload.days) {
          const cell: DayCell = perDay[day] || {
            in1: "",
            out1: "",
            in2: "",
            out2: "",
          };

          const del = await service
            .from("dtr_segments")
            .delete()
            .eq("employee_id", employeeId)
            .eq("work_date", day);
          if (del.error) throw del.error;

          const inserts: Array<SegmentInsert> = [];
          if (cell.in1 && cell.out1) {
            const s = toISO(day, cell.in1);
            const e1 = toISO(day, cell.out1);
            if (s && e1) {
              const row: Record<string, unknown> = {
                employee_id: employeeId,
                work_date: day,
                start_at: s,
                end_at: e1,
              };
              applyContextColumns(row, segmentColumns, { houseId, departmentId });
              inserts.push(row as SegmentInsert);
            }
          }
          if (cell.in2 && cell.out2) {
            const s = toISO(day, cell.in2);
            const e2 = toISO(day, cell.out2);
            if (s && e2) {
              const row: Record<string, unknown> = {
                employee_id: employeeId,
                work_date: day,
                start_at: s,
                end_at: e2,
              };
              applyContextColumns(row, segmentColumns, { houseId, departmentId });
              inserts.push(row as SegmentInsert);
            }
          }

          if (inserts.length) {
            const { error } = await service.from("dtr_segments").insert(inserts);
            if (error) throw error;
          }

          const firstIn = inserts.length ? inserts[0].start_at : null;
          const lastOut = inserts.length ? inserts[inserts.length - 1].end_at : null;
          const { error: upErr } = await service
            .from("dtr_entries")
            .upsert(
              (() => {
                const row: Record<string, unknown> = {
                  employee_id: employeeId,
                  work_date: day,
                  time_in: firstIn,
                  time_out: lastOut,
                } satisfies Partial<EntryUpsert>;
                applyContextColumns(row, entryColumns, { houseId, departmentId });
                return row as EntryUpsert;
              })(),
              { onConflict: "employee_id,work_date" },
            );
          if (upErr) throw upErr;
        }

        return NextResponse.json({ status: "ok" });
      }

      const ids = payload.employeeIds?.filter(Boolean) ?? [];
      if (!ids.length) {
        return NextResponse.json({ status: "ok" });
      }

      let employeeMap: Map<string, string | null> = new Map();
      try {
        employeeMap = await loadEmployeeDepartmentMap(service, ids, departmentIds);
      } catch (error) {
        console.error("[/api/payroll/dtr-bulk] failed to verify employees for bulk save", error);
        return NextResponse.json({ error: "Failed to resolve employees" }, { status: 500 });
      }

      const allowedIds = ids.filter((id: string) => employeeMap.has(id));
      if (!allowedIds.length) {
        return NextResponse.json({ status: "ok" });
      }

      const rows: EntryUpsert[] = [];
      for (const empId of allowedIds) {
        const perDay = payload.grid[empId] || {};
        for (const day of payload.days) {
          const cell: DayCell = perDay[day] || {
            in1: "",
            out1: "",
            in2: "",
            out2: "",
          };
          if ((cell.in1 && cell.in1.trim()) || (cell.out1 && cell.out1.trim())) {
            const row: Record<string, unknown> = {
              employee_id: empId,
              work_date: day,
              time_in: cell.in1 ? toISO(day, cell.in1) : null,
              time_out: cell.out1 ? toISO(day, cell.out1) : null,
            } satisfies Partial<EntryUpsert>;
            applyContextColumns(row, entryColumns, {
              houseId,
              departmentId: employeeMap.get(empId) ?? null,
            });
            rows.push(row as EntryUpsert);
          }
        }
      }

      if (rows.length) {
        const { error } = await service
          .from("dtr_entries")
          .upsert(rows, { onConflict: "employee_id,work_date" });
        if (error) throw error;
      }

      return NextResponse.json({ status: "ok" });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error("[/api/payroll/dtr-bulk] unexpected error", error, { payload: body });
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
