import type { Viewport } from "next";
import Script from "next/script";

import CustomerUtangClient from "./customer-utang-client";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function CustomerUtangPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <CustomerUtangClient />
    </>
  );
}
