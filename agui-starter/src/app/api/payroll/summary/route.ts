import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Legacy payroll summary API retired.",
      replacement: "/api/hr/payroll-preview",
    },
    { status: 410 },
  );
}
