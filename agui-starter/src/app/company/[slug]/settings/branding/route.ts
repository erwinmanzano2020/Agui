import { NextRequest, NextResponse } from "next/server";

import { z } from "@/lib/z";

import { updateWorkspaceBranding, WorkspaceSettingsUpdateError } from "@/lib/settings/workspace-update";
import { loadBusinessBySlug } from "@/lib/workspaces/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zod = z as unknown as any;

const payloadSchema = zod.object({
  brandName: zod.string().optional(),
  logoUrl: zod.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { message: "Invalid payload" } }, { status: 400 });
  }

  const business = await loadBusinessBySlug(slug);
  if (!business) {
    return NextResponse.json({ error: { message: "Workspace not found" } }, { status: 404 });
  }

  try {
    const branding = await updateWorkspaceBranding(business.id, {
      brandName: typeof parsed.data.brandName === "string" ? parsed.data.brandName : undefined,
      logoUrl: parsed.data.logoUrl,
    });

    return NextResponse.json({ ok: true, branding }, { status: 200 });
  } catch (error) {
    if (error instanceof WorkspaceSettingsUpdateError) {
      return NextResponse.json({ error: { message: error.message } }, { status: error.status });
    }

    console.error("Failed to update workspace branding", error);
    return NextResponse.json({ error: { message: "Unable to save branding" } }, { status: 500 });
  }
}
