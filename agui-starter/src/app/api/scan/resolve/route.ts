import { NextResponse } from "next/server";

import { z } from "@/lib/z";

import { resolveScan } from "@/lib/scan/runtime";

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { ok: false, error: "Expected application/json" },
      { status: 400 },
    );
  }

  const payload = await req.json().catch(() => ({}));
  const baseSchema = z
    .object({
      type: z.string().min(1, "type is required"),
      payload: z.unknown(),
      companyId: z.string().min(1).optional(),
    })
    .strict();

  type ResolveInput = ReturnType<(typeof baseSchema)["parse"]>;

  const schema = baseSchema.superRefine((value: ResolveInput, ctx) => {
    if (value.payload === null || value.payload === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "payload is required",
        path: ["payload"],
      });
    }
  });

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await resolveScan(parsed.data);
  return NextResponse.json(result, { status: 200 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Use POST /api/scan/resolve with JSON body" },
    { status: 405 },
  );
}
