import { NextResponse } from "next/server";
import { listSchemes } from "@/lib/loyalty/rules";

export async function GET() {
  const data = await listSchemes();
  return NextResponse.json({ schemes: data });
}
