import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildKioskSetupWizardUrl,
  buildProvisioningTokenPayload,
  normalizeProvisioningTokenInput,
} from "@/lib/hr/kiosk/provisioning-handoff";

const token = "v1.header.signature";

describe("kiosk provisioning handoff helpers", () => {
  it("builds a setup wizard URL without token leakage", () => {
    const url = buildKioskSetupWizardUrl({
      origin: "https://example.com",
      houseSlug: "acme",
    });

    assert.equal(url, "https://example.com/company/acme/kiosk?setup=1");
    assert.equal(url.includes(token), false);
  });

  it("returns raw token payload for provisioning QR", () => {
    assert.equal(buildProvisioningTokenPayload(token), token);
  });

  it("normalizes plain token input", () => {
    assert.equal(normalizeProvisioningTokenInput(token), token);
  });

  it("normalizes prefixed token input", () => {
    assert.equal(
      normalizeProvisioningTokenInput(`agui-kiosk-token::${token}`),
      token,
    );
  });

  it("normalizes URL query token input", () => {
    assert.equal(
      normalizeProvisioningTokenInput(`https://kiosk.local/provision?kioskToken=${token}`),
      token,
    );
  });
});
