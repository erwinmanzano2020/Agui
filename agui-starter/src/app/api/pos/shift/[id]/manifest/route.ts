import { NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/db.types";
import {
  calculateDenominationTotal,
  jsonToDenominationMap,
} from "@/lib/pos/shift-utils";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: shiftId } = await context.params;
  if (!shiftId) {
    return NextResponse.json({ error: "shift id missing" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient<Database>();

  const {
    data: shift,
    error: shiftError,
  } = await supabase
    .from("pos_shifts")
    .select(
      "id, branch_id, cashier_entity_id, opened_at, closed_at, verified_at, status, opening_float_json",
    )
    .eq("id", shiftId)
    .maybeSingle<{
      id: string;
      branch_id: string;
      cashier_entity_id: string;
      opened_at: string;
      closed_at: string | null;
      verified_at: string | null;
      status: string;
      opening_float_json: Json;
    }>();

  if (shiftError) {
    console.error("failed to load shift manifest", shiftError);
    return NextResponse.json({ error: "Failed to load shift" }, { status: 500 });
  }
  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  const { data: submission } = await supabase
    .from("pos_shift_submissions")
    .select("id, submitted_by, submitted_at, denominations_json, total_submitted, notes")
    .eq("shift_id", shiftId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      submitted_by: string;
      submitted_at: string;
      denominations_json: Json;
      total_submitted: number;
      notes: string | null;
    }>();

  const { data: verification } = await supabase
    .from("pos_shift_verifications")
    .select(
      "id, verified_by, verified_at, denominations_json, total_counted, variance_amount, variance_type, resolution, resolution_meta, notes",
    )
    .eq("shift_id", shiftId)
    .order("verified_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      id: string;
      verified_by: string;
      verified_at: string;
      denominations_json: Json;
      total_counted: number;
      variance_amount: number;
      variance_type: string;
      resolution: string;
      resolution_meta: Json;
      notes: string | null;
    }>();

  const { data: pool } = await supabase
    .from("pos_overage_pool")
    .select("balance_amount")
    .eq("branch_id", shift.branch_id)
    .eq("cashier_entity_id", shift.cashier_entity_id)
    .maybeSingle<{ balance_amount: number }>();

  const openingMap = jsonToDenominationMap(shift.opening_float_json);
  const openingTotal = calculateDenominationTotal(openingMap);

  const submissionTotal = submission ? submission.total_submitted ?? 0 : 0;
  const submissionMap = jsonToDenominationMap(submission?.denominations_json ?? {});
  const verificationMap = jsonToDenominationMap(verification?.denominations_json ?? {});
  const verificationTotal = verification ? verification.total_counted ?? 0 : 0;

  return NextResponse.json({
    shift: {
      id: shift.id,
      branchId: shift.branch_id,
      cashierEntityId: shift.cashier_entity_id,
      openedAt: shift.opened_at,
      closedAt: shift.closed_at,
      verifiedAt: shift.verified_at,
      status: shift.status,
    },
    openingFloat: {
      denominations: Object.fromEntries(openingMap.entries()),
      total: openingTotal,
    },
    submission: submission
      ? {
          id: submission.id,
          submittedBy: submission.submitted_by,
          submittedAt: submission.submitted_at,
          denominations: Object.fromEntries(submissionMap.entries()),
          total: submissionTotal,
          notes: submission.notes,
        }
      : null,
    verification: verification
      ? {
          id: verification.id,
          verifiedBy: verification.verified_by,
          verifiedAt: verification.verified_at,
          denominations: Object.fromEntries(verificationMap.entries()),
          total: verificationTotal,
          varianceAmount: verification.variance_amount,
          varianceType: verification.variance_type,
          resolution: verification.resolution,
          resolutionMeta: verification.resolution_meta,
          notes: verification.notes,
        }
      : null,
    variance: verification
      ? { type: verification.variance_type, amount: verification.variance_amount }
      : submission
        ? { type: "PENDING", amount: 0 }
        : null,
    overagePoolBalance: pool?.balance_amount ?? null,
  });
}
