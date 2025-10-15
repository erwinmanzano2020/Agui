import { NextResponse } from "next/server";
import { loadUiConfig } from "@/lib/ui-config";

export async function GET() {
  try {
    const config = await loadUiConfig();
    return NextResponse.json(config, { status: 200 });
  } catch (error: unknown) {
    // Strongly-typed catch + safe client message
    const message =
      error instanceof Error ? error.message : "Failed to load UI config";
    console.error("GET /api/ui/config failed:", error);
    // Return generic message to clients (avoid leaking internals)
    return NextResponse.json({ error: "Failed to load UI config" }, { status: 500 });
  }
}
