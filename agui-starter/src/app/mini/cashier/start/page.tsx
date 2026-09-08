import type { Viewport } from "next";
import Script from "next/script";

import CashierStartClient from "./start-client";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CashierStartMiniAppPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <CashierStartClient />
    </>
  );
}
