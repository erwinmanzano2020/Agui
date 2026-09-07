import Script from "next/script";

import ClosingClient from "./closing-client";

export const dynamic = "force-dynamic";

export default function CashierClosingMiniAppPage() {
  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" />
      <ClosingClient />
    </>
  );
}
