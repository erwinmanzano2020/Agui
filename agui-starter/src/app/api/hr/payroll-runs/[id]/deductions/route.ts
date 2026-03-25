import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api/http";
import { logApiError, logApiWarning } from "@/lib/api/logging";
import { AppFeature } from "@/lib/auth/permissions";
import { resolveHrRouteActorContext } from "@/app/api/hr/_shared/route-guard-order";
import {
  createPayrollRunDeduction,
  PayrollRunDeductionLockedError,
  PayrollRunDeductionMutationError,
  PayslipAccessError,
  resolvePayrollRunDeductionWriteContext,
} from "@/lib/hr/payslip-server";
import { z } from "@/lib/z";
import {
  payrollRouteAuthRequired,
  payrollRouteForbidden,
  payrollRouteNotFound,
  payrollRouteSuccess,
  payrollRouteUnexpected,
  payrollRouteValidation,
} from "../../route-boundary";

const ROUTE_NAME = "api/hr/payroll-runs/:id/deductions";
const SUCCESS_MESSAGE = "Deduction added.";

const ParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const BodySchema = z.object({
  employeeId: z.string().trim().uuid(),
  label: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

type BodyPayload = {
  employeeId: string;
  label: string;
  amount: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await resolveHrRouteActorContext({
    routeName: ROUTE_NAME,
    features: [AppFeature.PAYROLL, AppFeature.TEAM, AppFeature.DTR_BULK],
    onUnauthenticated: payrollRouteAuthRequired,
    onEntityNotLinked: payrollRouteForbidden,
  });
  if (actor instanceof NextResponse) return actor;
  const { supabase, userId, entityId } = actor;

  const parsedParams = ParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    const details = parsedParams.error.flatten().formErrors;
    return payrollRouteValidation(details[0]);
  }

  let payload: BodyPayload;
  try {
    payload = BodySchema.parse(await req.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request body";
    return payrollRouteValidation(message);
  }

  try {
    const target = await resolvePayrollRunDeductionWriteContext(supabase, { runId: parsedParams.data.id });
    if (!target) {
      return payrollRouteNotFound();
    }

    const result = await createPayrollRunDeduction(supabase, {
      runId: parsedParams.data.id,
      employeeId: payload.employeeId,
      label: payload.label,
      amount: payload.amount,
      createdBy: entityId,
    });

    return payrollRouteSuccess({ id: result?.id ?? null }, SUCCESS_MESSAGE);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof PayrollRunDeductionLockedError) {
      return jsonError(409, "Payroll run is locked", { message });
    }

    if (error instanceof PayslipAccessError) {
      logApiWarning({
        route: ROUTE_NAME,
        action: "access_denied",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return payrollRouteForbidden(message);
    }

    if (error instanceof PayrollRunDeductionMutationError) {
      logApiError({
        route: ROUTE_NAME,
        action: "create_deduction",
        userId,
        entityId,
        details: { runId: parsedParams.data.id },
        error: message,
      });
      return payrollRouteUnexpected(message);
    }

    logApiError({
      route: ROUTE_NAME,
      action: "create_deduction",
      userId,
      entityId,
      details: { runId: parsedParams.data.id },
      error: message,
    });

    return payrollRouteUnexpected(message);
  }
}
