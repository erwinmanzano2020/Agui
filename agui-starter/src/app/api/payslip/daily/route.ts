import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy daily payslip API retired.",
      replacement: "Use HR payroll runs and payslip surfaces.",
    },
    { status: 410 },
  );
}
