import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSupportedLogoFile, logoExtensionFromType, MAX_LOGO_SIZE_BYTES } from "./branding-logo-upload";

describe("branding logo upload validation", () => {
  it("rejects non-png/jpeg logo uploads", () => {
    const result = isSupportedLogoFile({ type: "image/svg+xml", size: 1024 } as File);
    assert.deepEqual(result, { ok: false, error: "Logo must be a PNG or JPEG image." });
    assert.equal(logoExtensionFromType("image/svg+xml"), null);
  });

  it("accepts png/jpeg and rejects files larger than 2MB", () => {
    assert.deepEqual(isSupportedLogoFile({ type: "image/png", size: 1024 } as File), { ok: true });
    assert.deepEqual(isSupportedLogoFile({ type: "image/jpeg", size: 1024 } as File), { ok: true });

    const tooLarge = isSupportedLogoFile({ type: "image/jpeg", size: MAX_LOGO_SIZE_BYTES + 1 } as File);
    assert.deepEqual(tooLarge, { ok: false, error: "Logo size must be 2MB or less." });
  });
});
