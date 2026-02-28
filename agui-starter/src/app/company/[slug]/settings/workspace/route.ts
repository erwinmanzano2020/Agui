import { NextRequest, NextResponse } from "next/server";

import { z } from "@/lib/z";

import { updateWorkspaceSettings, WorkspaceSettingsUpdateError } from "@/lib/settings/workspace-update";
import { loadBusinessBySlug } from "@/lib/workspaces/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zod = z as unknown as any;

const discountSchema = zod.object({
  loyalty: zod.string().nullable().optional(),
  wholesale: zod.string().nullable().optional(),
  manual: zod.string().nullable().optional(),
  promo: zod.string().nullable().optional(),
});

const payloadSchema = zod.object({
  values: zod
    .object({
      labels: zod
        .object({
          house: zod.string().nullable().optional(),
          branch: zod.string().nullable().optional(),
          pass: zod.string().nullable().optional(),
          discounts: discountSchema.optional(),
        })
        .optional(),
      receipt: zod
        .object({
          footerText: zod.string().nullable().optional(),
          showTotalSavings: zod.boolean().nullable().optional(),
          printProfile: zod.string().nullable().optional(),
        })
        .optional(),
      sop: zod
        .object({
          startShiftHint: zod.string().nullable().optional(),
          blindDropHint: zod.string().nullable().optional(),
          cashierVarianceThresholds: zod
            .object({
              small: zod.number().nullable().optional(),
              medium: zod.number().nullable().optional(),
              large: zod.number().nullable().optional(),
            })
            .nullable()
            .optional(),
        })
        .optional(),
      pos: zod
        .object({
          blindDropEnabled: zod.boolean().nullable().optional(),
          overagePool: zod
            .object({ enabled: zod.boolean().nullable().optional(), maxOffsetRatio: zod.number().nullable().optional() })
            .optional(),
        })
        .optional(),
      ui: zod.object({ alwaysShowStartBusinessTile: zod.boolean().nullable().optional() }).optional(),
      branding: zod
        .object({
          brandName: zod.string().nullable().optional(),
          logoUrl: zod.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    console.error("Invalid workspace settings payload", parsed.error);
    return NextResponse.json({ error: { message: "Invalid payload" } }, { status: 400 });
  }

  const business = await loadBusinessBySlug(slug);
  if (!business) {
    return NextResponse.json({ error: { message: "Workspace not found" } }, { status: 404 });
  }

  try {
    const updated = await updateWorkspaceSettings(business.id, parsed.data.values ?? {});
    return NextResponse.json({ ok: true, settings: updated });
  } catch (error) {
    if (error instanceof WorkspaceSettingsUpdateError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    }
    console.error("Failed to update workspace settings", error);
    return NextResponse.json({ error: { message: "Unable to save settings" } }, { status: 500 });
  }
}
