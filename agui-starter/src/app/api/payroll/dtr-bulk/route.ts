import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { assertManilaReasonableSegment, toManilaTimestamptz } from "@/lib/hr/timezone";
import { requireHrAccessWithBranch } from "@/lib/hr/access";
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
  operationIds: z.record(z.string()).default({}),
});

type DayCell = ReturnType<(typeof dayCell)["parse"]>;

export function hasOnlyAccessibleEmployeeIds(
  requestedIds: string[],
  employeeBranchMap: ReadonlyMap<string, string | null>,
  options: { allowUnassigned: boolean },
): boolean {
  return requestedIds.every((id) =>
    employeeBranchMap.has(id) && (options.allowUnassigned || employeeBranchMap.get(id) !== null),
  );
}

function toISO(date: string, hhmm: string) {
  const m = hhmm.trim().match(/^(\d{1,2})(:?)(\d{0,2})$/);
  if (!m) return null;
  const hh = Math.min(23, parseInt(m[1] || "0", 10)).toString().padStart(2, "0");
  const mmRaw = m[3] ? parseInt(m[3], 10) : 0;
  const mm = Math.min(59, isNaN(mmRaw) ? 0 : mmRaw).toString().padStart(2, "0");
  return toManilaTimestamptz(date, `${hh}:${mm}:00`);
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

async function resolveBranchesForHouse(
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

async function loadEmployeeBranchMap(
  service: SupabaseClient<Database>,
  employeeIds: string[],
  houseId: string,
  branchIds: string[],
): Promise<Map<string, string | null>> {
  if (!employeeIds.length || !branchIds.length) {
    return new Map();
  }

  const { data, error } = await service
    .from("employees")
    .select("id, branch_id, house_id")
    .eq("house_id", houseId)
    .in("id", employeeIds)
    .returns<Array<{ id: string; branch_id: string | null }>>();

  const allowedBranches = new Set(branchIds);

  if (error) {
    throw new Error(error.message);
  }

  const map = new Map<string, string | null>();
  for (const row of data ?? []) {
    const branchId = (row as { branch_id?: string | null }).branch_id ?? null;
    if (row.id && (branchId === null || allowedBranches.has(branchId))) {
      map.set(row.id, branchId);
    }
  }
  return map;
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
    console.error("[/api/payroll/dtr-bulk] invalid JSON payload", error);
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

  const parsedAction = loadSchema.safeParse(body).success ? "read" : "write";
  const access = await requireHrAccessWithBranch(supabase, { houseId, requiredLevel: parsedAction, requiredCapability: "payroll", writeScope: "branch-set-preflight" });
  if (!access.allowed) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  let branchIds: string[] = [];
  try {
    branchIds = access.isBranchLimited ? access.allowedBranchIds : await resolveBranchesForHouse(service, houseId);
  } catch (error) {
    console.error("[/api/payroll/dtr-bulk] failed to resolve departments", error);
    return NextResponse.json({ error: "Failed to resolve house departments" }, { status: 500 });
  }

  if (!branchIds.length) {
    return NextResponse.json({ error: "No accessible departments" }, { status: 403 });
  }

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

        try {
          const map = await loadEmployeeBranchMap(service, [employeeId], houseId, branchIds);
          if (!hasOnlyAccessibleEmployeeIds([employeeId], map, { allowUnassigned: !access.isBranchLimited })) {
            return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
          }
        } catch (error) {
          console.error("[/api/payroll/dtr-bulk] failed to verify employee department", error);
          return NextResponse.json({ error: "Failed to resolve employee" }, { status: 500 });
        }


        const { data, error } = await service
          .from("dtr_segments")
          .select("employee_id, work_date, time_in, time_out")
          .eq("employee_id", employeeId)
          .gte("work_date", payload.from)
          .lte("work_date", payload.to)
          .order("work_date", { ascending: true })
          .order("time_in", { ascending: true });
        if (error) throw error;
        return NextResponse.json({ segments: data ?? [] });
      }

      const ids = payload.employeeIds?.filter(Boolean) ?? [];
      if (!ids.length) {
        return NextResponse.json({ entries: [] });
      }

      let employeeMap: Map<string, string | null> = new Map();
      try {
        employeeMap = await loadEmployeeBranchMap(service, ids, houseId, branchIds);
      } catch (error) {
        console.error("[/api/payroll/dtr-bulk] failed to verify employees for load", error);
        return NextResponse.json({ error: "Failed to resolve employees" }, { status: 500 });
      }

      if (!hasOnlyAccessibleEmployeeIds(ids, employeeMap, { allowUnassigned: !access.isBranchLimited })) {
        return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
      }

      const { data, error } = await service
        .from("dtr_entries")
        .select("employee_id, work_date, time_in, time_out")
        .in("employee_id", ids)
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

        try {
          const map = await loadEmployeeBranchMap(service, [employeeId], houseId, branchIds);
          if (!hasOnlyAccessibleEmployeeIds([employeeId], map, { allowUnassigned: !access.isBranchLimited })) {
            return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
          }
        } catch (error) {
          console.error("[/api/payroll/dtr-bulk] failed to verify employee for save", error);
          return NextResponse.json({ error: "Failed to resolve employee" }, { status: 500 });
        }

        const perDay = payload.grid[employeeId] ?? {};
        for (const day of payload.days) {
          const cell: DayCell = perDay[day] || {
            in1: "",
            out1: "",
            in2: "",
            out2: "",
          };
          const operationId = payload.operationIds[day];
          if (!operationId) {
            return NextResponse.json(
              { error: `Missing stable operation identity for ${day}` },
              { status: 400 },
            );
          }

          const segments: Array<{ timeIn: string; timeOut: string }> = [];
          for (const [label, rawIn, rawOut] of [
            ["in1/out1", cell.in1, cell.out1],
            ["in2/out2", cell.in2, cell.out2],
          ] as const) {
            if (!rawIn || !rawOut) continue;
            const timeIn = toISO(day, rawIn);
            const timeOut = toISO(day, rawOut);
            if (!timeIn || !timeOut) {
              throw new Error(`Invalid segment ${day} (${label})`);
            }
            const validation = assertManilaReasonableSegment(timeIn, timeOut, day);
            if (!validation.ok) {
              throw new Error(
                `Invalid segment ${day} (${label}): ${validation.reasons.join(", ")}`,
              );
            }
            segments.push({ timeIn, timeOut });
          }

          const { error: commandError } = await supabase.rpc(
            "hr_replace_bulk_attendance_day",
            {
              p_house_id: houseId,
              p_employee_id: employeeId,
              p_work_date: day,
              p_operation_id: operationId,
              p_segments: segments,
            },
          );
          if (commandError) throw new Error(commandError.message);
        }

        return NextResponse.json({ status: "ok" });
      }

      const ids = payload.employeeIds?.filter(Boolean) ?? [];
      if (!ids.length) {
        return NextResponse.json({ status: "ok" });
      }

      let employeeMap: Map<string, string | null> = new Map();
      try {
        employeeMap = await loadEmployeeBranchMap(service, ids, houseId, branchIds);
      } catch (error) {
        console.error("[/api/payroll/dtr-bulk] failed to verify employees for bulk save", error);
        return NextResponse.json({ error: "Failed to resolve employees" }, { status: 500 });
      }

      const allowedIds = ids.filter((id: string) => employeeMap.has(id));
      if (!hasOnlyAccessibleEmployeeIds(ids, employeeMap, { allowUnassigned: !access.isBranchLimited })) {
        return NextResponse.json({ error: "Employee not accessible" }, { status: 403 });
      }

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
            const timeIn = cell.in1 ? toISO(day, cell.in1) : null;
            const timeOut = cell.out1 ? toISO(day, cell.out1) : null;
            const { error } = await supabase.rpc(
              "hr_upsert_bulk_dtr_entry_summary",
              {
                p_house_id: houseId,
                p_employee_id: empId,
                p_work_date: day,
                p_time_in: timeIn,
                p_time_out: timeOut,
              },
            );
            if (error) throw new Error(error.message);
          }
        }
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
