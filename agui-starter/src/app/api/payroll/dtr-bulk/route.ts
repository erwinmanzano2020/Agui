import { NextResponse, type NextRequest } from "next/server";
import { z } from "@/lib/z";

import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { getServiceSupabase } from "@/lib/supabase-service";

const loadSchema = z.object({
  action: z.literal("load"),
  mode: z.enum(["single", "all"]),
  from: z.string(),
  to: z.string(),
  employeeId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
});

const dayCell = z.object({
  in1: z.string().optional().default(""),
  out1: z.string().optional().default(""),
  in2: z.string().optional().default(""),
  out2: z.string().optional().default(""),
});

const saveSchema = z.object({
  action: z.literal("save"),
  mode: z.enum(["single", "all"]),
  days: z.array(z.string()),
  employeeId: z.string().optional(),
  employeeIds: z.array(z.string()).optional(),
  grid: z.record(z.record(dayCell)).default({}),
});

type DayCell = z.infer<typeof dayCell>;

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

  const service = getServiceSupabase();

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
              inserts.push({
                employee_id: employeeId,
                work_date: day,
                start_at: s,
                end_at: e1,
                company_id: null,
              });
            }
          }
          if (cell.in2 && cell.out2) {
            const s = toISO(day, cell.in2);
            const e2 = toISO(day, cell.out2);
            if (s && e2) {
              inserts.push({
                employee_id: employeeId,
                work_date: day,
                start_at: s,
                end_at: e2,
                company_id: null,
              });
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
              {
                employee_id: employeeId,
                work_date: day,
                time_in: firstIn,
                time_out: lastOut,
                company_id: null,
              } satisfies EntryUpsert,
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

      const rows: EntryUpsert[] = [];
      for (const empId of ids) {
        const perDay = payload.grid[empId] || {};
        for (const day of payload.days) {
          const cell: DayCell = perDay[day] || {
            in1: "",
            out1: "",
            in2: "",
            out2: "",
          };
          if ((cell.in1 && cell.in1.trim()) || (cell.out1 && cell.out1.trim())) {
            rows.push({
              employee_id: empId,
              work_date: day,
              time_in: cell.in1 ? toISO(day, cell.in1) : null,
              time_out: cell.out1 ? toISO(day, cell.out1) : null,
              company_id: null,
            });
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
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
