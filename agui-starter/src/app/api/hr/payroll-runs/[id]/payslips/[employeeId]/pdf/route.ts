import { NextRequest } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  computePayslipsForPayrollRun,
  PayslipAccessError,
  PayslipFetchError,
  PayslipValidationError,
} from "@/lib/hr/payslip-server";
import { generatePayslipPdf, type PayslipPdfFormat } from "@/lib/hr/payslip-pdf";
import { requireHrAccess } from "@/lib/hr/access";
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
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: () => jsonError(401, "Not authenticated"),
    onEntityNotLinked: () => jsonError(403, "Account not linked"),
  });
  if (actor instanceof Response) return actor;

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
    const { data: run, error: runError } = await actor.supabase
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

    const access = await requireHrAccess(actor.supabase, run.house_id);
    if (!access.allowed) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId: actor.userId,
        entityId: actor.entityId,
        details: { runId, employeeId, houseId: run.house_id },
      });
      return jsonError(403, "Not allowed");
    }

    const rows = await computePayslipsForPayrollRun(
      actor.supabase,
      { houseId: run.house_id, runId, employeeId },
      { access },
    );

    const row = rows[0];
    if (!row) {
      return jsonError(404, "Payslip preview not found");
    }

    const pdfDeductionsTotal = row.deductionsTotal + row.undertimeDeduction;
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
      undertimeDeduction: row.undertimeDeduction,
      deductions: row.otherDeductions,
      deductionsTotal: pdfDeductionsTotal,
      grossPay: row.grossPay,
      netPay: row.netPay,
      format: (parsedQuery.data.format ?? "a4") as PayslipPdfFormat,
    });
    const pdfBuffer = pdfBytes.buffer.slice(
      pdfBytes.byteOffset,
      pdfBytes.byteOffset + pdfBytes.byteLength,
    ) as ArrayBuffer;

    const refSegment = run.reference_code ?? run.id;
    const safeEmployeeName = sanitizeFilename(row.employeeName || "employee");
    const filename = `Payslip-${refSegment}-${safeEmployeeName || "employee"}.pdf`;

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
        userId: actor.userId,
        entityId: actor.entityId,
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
        userId: actor.userId,
        entityId: actor.entityId,
        details: { runId, employeeId },
        error: message,
      });
      return jsonError(500, "Failed to load payslip", { message });
    }

    logApiError({
      route: ROUTE_NAME,
      action: "generate_payslip_pdf",
      userId: actor.userId,
      entityId: actor.entityId,
      details: { runId, employeeId },
      error: message,
    });

    return jsonError(500, "Failed to generate payslip PDF", { message });
  }
}
