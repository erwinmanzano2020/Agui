import { handleKioskPing } from "@/lib/hr/kiosk/http";

export async function POST(request: Request) {
  return handleKioskPing(request);
}
