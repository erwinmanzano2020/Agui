import "server-only";

import type { CustomerUtangContextResponse } from "@/lib/mobile/customer-utang";
import {
  CashierStartRouteError,
  cashierStartFailureStatus,
  resolveCashierStartAuth,
} from "@/lib/mobile/cashier-start.server";

export { CashierStartRouteError as CustomerUtangRouteError };

export function customerUtangFailureStatus(code?: string) {
  if (code === "STALE_PREVIOUS_DAY_SHIFT" || code === "STALE_SHIFT") return 409;
  if (code === "NO_OPEN_SHIFT") return 409;
  return cashierStartFailureStatus(code);
}

export async function loadCustomerUtangContext(initData?: string): Promise<CustomerUtangContextResponse> {
  const auth = await resolveCashierStartAuth(initData);
  const appsScriptUrl = process.env.AGUI_APPS_SCRIPT_WEB_APP_URL ?? process.env.AGUI_APPS_SCRIPT_API_URL ?? "";
  const proxySecret = process.env.AGUI_MINI_APP_API_SECRET ?? process.env.AGUI_APPS_SCRIPT_API_SECRET ?? "";

  if (!appsScriptUrl || !proxySecret) {
    throw new CashierStartRouteError("Agui Customer Utang service is not configured.", "SERVER_NOT_CONFIGURED", 503);
  }

  let response: Response;
  try {
    const url = new URL(appsScriptUrl);
    url.searchParams.set("channel", "miniapp");
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxySecret, action: "CUSTOMER_UTANG_CONTEXT", ...auth }),
    });
  } catch {
    throw new CashierStartRouteError("Agui Customer Utang service is temporarily unreachable.", "UPSTREAM_UNREACHABLE", 502);
  }

  try {
    const result = (await response.json()) as CustomerUtangContextResponse;
    if (result.ok) return { ...result, authMode: auth.authMode };
    return result;
  } catch {
    throw new CashierStartRouteError("Agui Customer Utang service returned an invalid response.", "UPSTREAM_BAD_RESPONSE", 502);
  }
}
