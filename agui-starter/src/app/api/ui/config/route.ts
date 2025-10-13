import { NextResponse } from "next/server";
import { loadUiConfig } from "@/lib/ui-config";

export async function GET() {
  try {
    const config = await loadUiConfig();
    return NextResponse.json(config, { status: 200 });
  } catch (err) {
    console.error("GET /api/ui/config failed:", err);
    return NextResponse.json(
      { error: "Failed to load UI config" },
      { status: 500 }
    );
  }
}
