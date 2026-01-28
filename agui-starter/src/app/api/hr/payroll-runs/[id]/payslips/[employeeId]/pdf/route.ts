import { NextRequest } from "next/server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { requireAnyFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import type { Database } from "@/lib/db.types";
import { resolveEntityIdForUser } from "@/lib/identity/entity-server";
import {
  computePayslipsForPayrollRun,
  PayslipAccessError,
  PayslipFetchError,
  PayslipValidationError,
} from "@/lib/hr/payslip-server";
import { generatePayslipPdf, type PayslipPdfFormat } from "@/lib/hr/payslip-pdf";
import { requireHrAccess } from "@/lib/hr/access";
import { getServiceSupabase } from "@/lib/supabase-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "@/lib/z";

const ROUTE_NAME = "api/hr/payroll-runs/:id/payslips/:employeeId/pdf";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
  employeeId: z.string().trim().uuid(),
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; employeeId: string }> },
) {
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

  const { id: runId, employeeId } = parsedParams.data;

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
        details: { runId, employeeId, houseId: run.house_id },
      });
      return jsonError(403, "Not allowed");
    }

    const rows = await computePayslipsForPayrollRun(
      supabase,
      { houseId: run.house_id, runId, employeeId },
      { access },
    );

    const row = rows[0];
    if (!row) {
      return jsonError(404, "Payslip preview not found");
    }

    const pdfBytes = generatePayslipPdf({
      employeeName: row.employeeName,
      employeeCode: row.employeeCode,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      runReferenceCode: run.reference_code ?? null,
      runStatus: run.status,
      finalizedAt: run.finalized_at,
      postedAt: run.posted_at,
      paidAt: run.paid_at,
      regularPay: row.regularPay,
      overtimePay: row.overtimePay,
      deductions: row.otherDeductions,
      deductionsTotal: row.deductionsTotal,
      grossPay: row.grossPay,
      netPay: row.netPay,
      format: (parsedQuery.data.format ?? "a4") as PayslipPdfFormat,
    });

    const refSegment = run.reference_code ?? run.id;
    const safeEmployeeName = sanitizeFilename(row.employeeName || "employee");
    const filename = `Payslip-${refSegment}-${safeEmployeeName || "employee"}.pdf`;

    return new Response(pdfBytes, {
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
        details: { runId, employeeId },
        error: message,
      });
      return jsonError(403, "Not allowed", { message });
    }

    if (error instanceof PayslipValidationError) {
      return jsonError(400, "Invalid payslip parameters", { message });
    }

    if (error instanceof PayslipFetchError) {
      logApiError({
        route: ROUTE_NAME,
        action: "fetch_payslip_pdf",
        userId: userResult.user.id,
        entityId,
        details: { runId, employeeId },
        error: message,
      });
      return jsonError(500, "Failed to load payslip", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "generate_payslip_pdf",
      userId: userResult.user.id,
      entityId,
      details: { runId, employeeId },
      error: message,
    });

    return jsonError(500, "Failed to generate payslip PDF", { message });
  }
}
