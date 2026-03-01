import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isSupportedLogoFile,
  logoExtensionFromType,
  MAX_LOGO_SIZE_BYTES,
  uploadBrandingLogo,
  getLogoUrlWarning,
} from "./branding-logo-upload";

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

  it("warns for google drive view links", () => {
    assert.equal(
      getLogoUrlWarning("https://drive.google.com/file/d/1abcDEF/view?usp=sharing"),
      "This looks like a web page link; please use a direct PNG/JPG URL or upload a file.",
    );
    assert.equal(getLogoUrlWarning("https://cdn.example.com/logo.png"), null);
  });
});

describe("uploadBrandingLogo", () => {
  it("surfaces upload errors and rejects", async () => {
    const storage = {
      remove: async () => ({ error: null }),
      upload: async () => ({ error: { message: "forbidden" } }),
      getPublicUrl: () => ({ data: { publicUrl: "https://cdn.example.com/logo.png" } }),
    };

    await assert.rejects(
      () =>
        uploadBrandingLogo({
          storage,
          businessId: "house-1",
          file: { type: "image/png", size: 100, name: "logo.png" } as File,
          persistLogoUrl: async () => undefined,
        }),
      (error) => error instanceof Error && error.message === "forbidden",
    );
  });

  it("returns public URL and persists logo_url after successful upload", async () => {
    let persistedUrl: string | null = null;
    const storage = {
      remove: async () => ({ error: null }),
      upload: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: "https://abc.supabase.co/storage/v1/object/public/house-assets/houses/house-1/branding/logo.png" } }),
    };

    const result = await uploadBrandingLogo({
      storage,
      businessId: "house-1",
      file: { type: "image/png", size: 100, name: "logo.png" } as File,
      persistLogoUrl: async (logoUrl) => {
        persistedUrl = logoUrl;
      },
    });

    assert.equal(result.logoUrl, "https://abc.supabase.co/storage/v1/object/public/house-assets/houses/house-1/branding/logo.png");
    assert.equal(persistedUrl, result.logoUrl);
  });
});
