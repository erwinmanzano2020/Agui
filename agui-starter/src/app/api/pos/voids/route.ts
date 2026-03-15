import { NextResponse } from "next/server";

import { requireFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { emitEvents } from "@/lib/events/server";
import { computeVoidSummary } from "@/lib/pos/returns";

export const dynamic = "force-dynamic";

type SupervisorApproval = {
  approverId?: string;
  reasonCode?: string;
  pin?: string;
};

type VoidRequestBody = Parameters<typeof computeVoidSummary>[0] & {
  supervisorApproval?: SupervisorApproval;
};

type VoidResponse = ReturnType<typeof computeVoidSummary> & {
  ok: true;
};

function ensureSupervisorApproval(approval: SupervisorApproval | undefined): void {
  if (!approval) {
    throw new Error("Supervisor approval is required to void a sale");
  }
  if (!approval.approverId || !approval.reasonCode) {
    throw new Error("Supervisor approval is missing approver or reason");
  }
  if (!approval.pin || approval.pin.trim().length < 4) {
    throw new Error("Supervisor approval PIN is invalid");
  }
}

export async function POST(request: Request) {
  const deny = await requireFeatureAccessApi(AppFeature.POS);
  if (deny) return deny;

  const body = (await request.json().catch(() => ({}))) as VoidRequestBody;
  try {
    ensureSupervisorApproval(body.supervisorApproval);
    const summary = computeVoidSummary(body);
    const response: VoidResponse = { ok: true, ...summary };

    await emitEvents(["sale:void"], "info", {
      saleId: summary.saleId,
      reason: summary.reason,
      approvedBy: summary.approvedBy,
    }).catch(() => undefined);

    return NextResponse.json(response satisfies VoidResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record void";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
