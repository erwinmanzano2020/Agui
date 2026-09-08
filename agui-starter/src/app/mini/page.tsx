import type { Viewport } from "next";
import Script from "next/script";

import MobileHomeClient from "./mobile-home-client";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function AguiMobilePage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <MobileHomeClient />
    </>
  );
}
