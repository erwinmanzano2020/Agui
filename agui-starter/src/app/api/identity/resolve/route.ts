import { NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["email", "phone", "user"]);
const ALLOWED_DIRECTIONS = new Set(["forward", "reverse"]);

export async function GET(req: Request) {
  const url = new URL(req.url);

  const type = url.searchParams.get("type") ?? "";
  const value = url.searchParams.get("value") ?? "";
  const direction = url.searchParams.get("direction") ?? "forward";

  const errors: string[] = [];

  if (!ALLOWED_TYPES.has(type)) {
    errors.push(
      `Invalid type. Expected one of: ${Array.from(ALLOWED_TYPES).join(", ")}.`,
    );
  }

  if (!value.trim()) {
    errors.push("Value is required.");
  }

  if (!ALLOWED_DIRECTIONS.has(direction)) {
    errors.push(
      `Invalid direction. Expected one of: ${Array.from(ALLOWED_DIRECTIONS).join(", ")}.`,
    );
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Invalid query", details: errors }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    resolved: {
      type,
      value,
      direction,
    },
  });
}
