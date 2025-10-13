// agui-starter/src/app/api/ui/config/route.ts
import { NextResponse } from "next/server";
import { loadUiConfig } from "@/lib/ui-config";

export async function GET() {
  try {
    const config = await loadUiConfig();
    return NextResponse.json(config, { status: 200 });
  } catch (error) {
    console.error("Failed to load UI config", error);
    return NextResponse.json(
      { error: "Failed to load UI configuration" },
      { status: 500 },
    );
  }
}
