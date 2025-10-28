import { NextResponse } from "next/server";
import { z } from "zod";

const TypeSchema = z.enum(["email", "phone"]);
const DirectionSchema = z.enum(["forward", "reverse"]);

const QuerySchema = z.object({
  type: TypeSchema,
  value: z.string().min(1, "value is required"),
  direction: DirectionSchema,
});

export async function GET(req: Request) {
  const url = new URL(req.url);

  const parsed = QuerySchema.safeParse({
    type: url.searchParams.get("type"),
    value: url.searchParams.get("value"),
    direction: url.searchParams.get("direction") ?? "forward",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { type, value, direction } = parsed.data;

  return NextResponse.json({ type, value, direction });
}
