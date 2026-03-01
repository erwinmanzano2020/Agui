import { handleKioskVerify } from "@/lib/hr/kiosk/http";

export async function POST(request: Request) {
  return handleKioskVerify(request);
}
