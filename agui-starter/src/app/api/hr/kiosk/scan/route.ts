import { handleKioskScan } from "@/lib/hr/kiosk/http";

export async function POST(request: Request) {
  return handleKioskScan(request);
}
