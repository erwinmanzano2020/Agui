// agui-starter/src/app/api/ui/config/route.ts
import { NextResponse } from "next/server";
import { loadUiConfig } from "@/lib/ui-config";

export async function GET() {
  const cfg = await loadUiConfig();
  return NextResponse.json(cfg);
}
