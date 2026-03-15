import { handleKioskSync } from "@/lib/hr/kiosk/http";

export async function POST(request: Request) {
  return handleKioskSync(request);
}
