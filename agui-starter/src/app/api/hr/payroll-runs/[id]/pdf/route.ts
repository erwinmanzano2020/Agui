import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import { generatePayrollRunPdf } from "@/lib/hr/payroll-run-pdf";
import {
  computePayslipsForPayrollRun,
  PayslipAccessError,
  PayslipFetchError,
  PayslipValidationError,
} from "@/lib/hr/payslip-server";
import { requireHrAccess } from "@/lib/hr/access";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/pdf";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const QuerySchema = z.object({
  format: z.enum(["a4", "letter"]).optional(),
});

const ALLOWED_STATUSES = new Set(["finalized", "posted", "paid"]);

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function sortKey(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyFeatureAccessApi([
    AppFeature.PAYROLL,
    AppFeature.TEAM,
    AppFeature.DTR_BULK,
  ]);
  if (guard) return guard;

  let supabase: SupabaseClient<Database>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    logApiError({ route: ROUTE_NAME, action: "init_supabase_client", error });
    return jsonError(503, "Supabase not configured");
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) {
    logApiError({ route: ROUTE_NAME, action: "get_user", error: userError });
    return jsonError(500, "Failed to load user", { code: userError.code });
  }

  if (!userResult.user) {
    logApiWarning({ route: ROUTE_NAME, action: "unauthenticated" });
    return jsonError(401, "Not authenticated");
  }

  const admin = getServiceSupabase();
  let entityId: string | null = null;
  try {
    entityId = await resolveEntityIdForUser(userResult.user, admin);
  } catch (error) {
    logApiError({ route: ROUTE_NAME, action: "resolve_entity", userId: userResult.user.id, error });
    return jsonError(500, "Failed to resolve account");
  }

  if (!entityId) {
    logApiWarning({ route: ROUTE_NAME, action: "entity_not_linked", userId: userResult.user.id });
    return jsonError(403, "Account not linked");
  }

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    const details = parsedParams.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  const url = new URL(req.url);
  const parsedQuery = QuerySchema.safeParse({
    format: url.searchParams.get("format") ?? undefined,
  });

  if (!parsedQuery.success) {
    const details = parsedQuery.error.flatten().formErrors;
    return jsonError(400, "Fix the highlighted fields and try again.", {
      message: details[0] ?? "Missing or invalid parameters.",
    });
  }

  const { id: runId } = parsedParams.data;

  try {
    const { data: run, error: runError } = await supabase
      .from("hr_payroll_runs")
      .select(
        "id, house_id, period_start, period_end, status, reference_code, finalized_at, posted_at, paid_at",
      )
      .eq("id", runId)
      .maybeSingle();

    if (runError) {
      throw new PayslipFetchError(runError.message);
    }

    if (!run) {
      return jsonError(404, "Payroll run not found");
    }

    if (!ALLOWED_STATUSES.has(run.status)) {
      return jsonError(409, "Payroll run must be finalized before exporting.");
    }

    const access = await requireHrAccess(supabase, run.house_id);
    if (!access.allowed) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
        entityId,
        details: { runId, houseId: run.house_id },
      });
      return jsonError(403, "Not allowed");
    }

    const { data: house, error: houseError } = await supabase
      .from("houses")
      .select("id, name")
      .eq("id", run.house_id)
      .maybeSingle<{ id: string; name: string }>();

    if (houseError) {
      throw new PayslipFetchError(houseError.message);
    }

    const runItemsResult = await supabase
      .from("hr_payroll_run_items")
      .select("missing_schedule_days, open_segment_days, corrected_segment_days, employee_id")
      .eq("run_id", runId)
      .order("employee_id", { ascending: true });

    if (runItemsResult.error) {
      throw new PayslipFetchError(runItemsResult.error.message);
    }

    const runItems = runItemsResult.data ?? [];

    const rows = await computePayslipsForPayrollRun(
      supabase,
      { houseId: run.house_id, runId },
      { access },
    );

    const orderedRows = [...rows].sort((a, b) => {
      const aKey = sortKey(a.employeeName) || sortKey(a.employeeCode) || a.employeeId;
      const bKey = sortKey(b.employeeName) || sortKey(b.employeeCode) || b.employeeId;
      if (aKey === bKey) {
        return a.employeeId.localeCompare(b.employeeId);
      }
      return aKey.localeCompare(bKey);
    });

    const summary = orderedRows.reduce(
      (acc, row) => {
        acc.totalEmployees += 1;
        acc.totalRegularPay += row.regularPay;
        acc.totalOvertimePay += row.overtimePay;
        acc.totalUndertimeDeductions += row.undertimeDeduction;
        acc.totalManualDeductions += row.deductionsTotal;
        acc.totalGrossPay += row.grossPay;
        acc.totalNetPay += row.netPay;
        return acc;
      },
      {
        totalEmployees: 0,
        totalRegularPay: 0,
        totalOvertimePay: 0,
        totalUndertimeDeductions: 0,
        totalManualDeductions: 0,
        totalGrossPay: 0,
        totalNetPay: 0,
      },
    );

    const diagnostics = runItems.reduce(
      (acc, item) => {
        acc.missingScheduleDays += item.missing_schedule_days ?? 0;
        acc.correctedSegments += item.corrected_segment_days ?? 0;
        acc.openSegments += item.open_segment_days ?? 0;
        return acc;
      },
      { missingScheduleDays: 0, correctedSegments: 0, openSegments: 0 },
    );

    const pdfBytes = generatePayrollRunPdf({
      houseName: house?.name ?? "House",
      periodStart: run.period_start,
      periodEnd: run.period_end,
      runStatus: run.status,
      runReferenceCode: run.reference_code,
      summary: {
        ...summary,
        missingScheduleDays: diagnostics.missingScheduleDays,
        correctedSegments: diagnostics.correctedSegments,
        openSegments: diagnostics.openSegments,
      },
      payslips: orderedRows.map((row) => ({
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        runReferenceCode: run.reference_code ?? "(not posted)",
        runStatus: run.status,
        finalizedAt: run.finalized_at,
        postedAt: run.posted_at,
        paidAt: run.paid_at,
        regularPay: row.regularPay,
        overtimePay: row.overtimePay,
        undertimeDeduction: row.undertimeDeduction,
        deductions: row.otherDeductions,
        deductionsTotal: row.deductionsTotal + row.undertimeDeduction,
        grossPay: row.grossPay,
        netPay: row.netPay,
        format: parsedQuery.data.format,
      })),
      format: parsedQuery.data.format,
    });

    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;

    const refSegment = run.reference_code ?? run.id;
    const filename = `Payroll-${sanitizeFilename(refSegment)}-${sanitizeFilename(
      run.period_start,
    )}_${sanitizeFilename(run.period_end)}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof PayslipAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: userResult.user.id,
        entityId,
        details: { runId },
        error: message,
      });
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayslipValidationError) {
      return jsonError(400, "Invalid payroll run parameters", { message });
    }

    if (error instanceof PayslipFetchError) {
      logApiError({
        route: ROUTE_NAME,
        action: "fetch_payroll_run_pdf",
        userId: userResult.user.id,
        entityId,
        details: { runId },
        error: message,
      });
      return jsonError(500, "Failed to load payroll run", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "generate_payroll_run_pdf",
      userId: userResult.user.id,
      entityId,
      details: { runId },
      error: message,
    });

    return jsonError(500, "Failed to generate payroll run PDF", { message });
  }
}
