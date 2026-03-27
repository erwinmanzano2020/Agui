const KIOSK_TOKEN_PREFIX = "agui-kiosk-token::";
const KIOSK_TOKEN_QUERY_KEYS = ["kioskToken", "token"] as const;

export function buildKioskSetupWizardUrl(input: { origin: string; houseSlug: string }): string {
  const url = new URL(`/company/${input.houseSlug}/kiosk`, input.origin);
  url.searchParams.set("setup", "1");
  return url.toString();
}

export function buildProvisioningTokenPayload(token: string): string {
  return `${KIOSK_TOKEN_PREFIX}${token}`;
}

export function normalizeProvisioningTokenInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(trimmed)) {
    return trimmed;
  }

  const prefixed = trimmed.toLowerCase().startsWith(KIOSK_TOKEN_PREFIX)
    ? trimmed.slice(KIOSK_TOKEN_PREFIX.length)
    : null;
  if (prefixed && /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(prefixed.trim())) {
    return prefixed.trim();
  }

  try {
    const parsed = new URL(trimmed);
    for (const key of KIOSK_TOKEN_QUERY_KEYS) {
      const value = parsed.searchParams.get(key);
      if (value && /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(value.trim())) {
        return value.trim();
      }
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}
