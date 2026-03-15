import { NextResponse } from "next/server";

import { requireFeatureAccessApi } from "@/lib/auth/feature-guard";
import { AppFeature } from "@/lib/auth/permissions";
import { emitEvents } from "@/lib/events/server";
import { aggregateManifest, type TenderLine, validateTenderLines } from "@/lib/pos/tenders";

export const dynamic = "force-dynamic";

type CheckoutRequest = {
  saleId?: string;
  shiftId?: string;
  amountDue?: number;
  tenders?: TenderLine[];
  allowChange?: boolean;
  loyaltyBalance?: number;
  loyaltyConversionRate?: number;
  cashierUserId?: string;
};

type CheckoutResponse = {
  ok: true;
  saleId: string | null;
  totals: {
    amountDue: number;
    totalTendered: number;
    changeDue: number;
  };
  payments: ReturnType<typeof validateTenderLines>["normalizedTenders"];
  manifest: ReturnType<typeof aggregateManifest>;
};

export async function POST(request: Request) {
  const deny = await requireFeatureAccessApi(AppFeature.POS);
  if (deny) return deny;

  const body = (await request.json().catch(() => ({}))) as CheckoutRequest;
  try {
    const validation = validateTenderLines({
      amountDue: body.amountDue ?? 0,
      allowChange: body.allowChange,
      loyaltyBalance: body.loyaltyBalance,
      loyaltyConversionRate: body.loyaltyConversionRate,
      tenders: Array.isArray(body.tenders) ? body.tenders : [],
    });

    const manifest = aggregateManifest(validation.normalizedTenders);
    const response: CheckoutResponse = {
      ok: true,
      saleId: body.saleId ?? null,
      totals: {
        amountDue: validation.amountDue,
        totalTendered: validation.totalTendered,
        changeDue: validation.changeDue,
      },
      payments: validation.normalizedTenders,
      manifest,
    };

    const events: string[] = ["sale:paid"];
    if (body.shiftId) {
      events.push(`pos:shift:${body.shiftId}`);
    }
    if (body.cashierUserId) {
      events.push(`tiles:user:${body.cashierUserId}`);
    }

    if (events.length > 0) {
      await Promise.all(
        events.map((topic) =>
          emitEvents([topic], topic.startsWith("sale") ? "info" : "invalidate", {
            saleId: body.saleId ?? null,
            shiftId: body.shiftId ?? null,
          }).catch(() => undefined),
        ),
      );
    }

    return NextResponse.json(response satisfies CheckoutResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to validate checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
