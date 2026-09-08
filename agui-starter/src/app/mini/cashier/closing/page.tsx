import type { Viewport } from "next";
import Script from "next/script";

import ClosingClient from "./closing-client";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CashierClosingMiniAppPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <ClosingClient />
    </>
  );
}
