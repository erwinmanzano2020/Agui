import "server-only";

import type { DIRECT_AUTH_ACTIONS } from "@/lib/mobile/direct-auth";

type DirectAuthAction = (typeof DIRECT_AUTH_ACTIONS)[keyof typeof DIRECT_AUTH_ACTIONS];

export class DirectAuthProxyError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "DirectAuthProxyError";
    this.code = code;
    this.status = status;
  }
}

function directAuthPocEnabled() {
  return process.env.AGUI_MOBILE_DIRECT_AUTH_POC === "enabled";
}

export async function callDirectAuthUpstream(
  action: DirectAuthAction,
  fields: Record<string, unknown>,
): Promise<unknown> {
  if (!directAuthPocEnabled()) {
    throw new DirectAuthProxyError(
      "Direct browser staff sign-in is not enabled on this server yet.",
      "DIRECT_AUTH_NOT_ENABLED",
      503,
    );
  }

  const appsScriptUrl = process.env.AGUI_APPS_SCRIPT_WEB_APP_URL ?? process.env.AGUI_APPS_SCRIPT_API_URL ?? "";
  const proxySecret = process.env.AGUI_MINI_APP_API_SECRET ?? process.env.AGUI_APPS_SCRIPT_API_SECRET ?? "";
  if (!appsScriptUrl || !proxySecret) {
    throw new DirectAuthProxyError(
      "Agui direct-auth upstream is not configured.",
      "DIRECT_AUTH_SERVER_NOT_CONFIGURED",
      503,
    );
  }

  let response: Response;
  try {
    const url = new URL(appsScriptUrl);
    url.searchParams.set("channel", "miniapp");
    response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxySecret, action, ...fields }),
    });
  } catch {
    throw new DirectAuthProxyError(
      "Agui direct-auth service is temporarily unreachable.",
      "DIRECT_AUTH_UPSTREAM_UNREACHABLE",
      502,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new DirectAuthProxyError(
      "Agui direct-auth service returned an invalid response.",
      "DIRECT_AUTH_UPSTREAM_BAD_RESPONSE",
      502,
    );
  }
}
