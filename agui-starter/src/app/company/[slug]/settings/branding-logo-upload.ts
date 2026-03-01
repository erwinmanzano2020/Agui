export const LOGO_BUCKET = "house-assets";
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg"]);

export function logoExtensionFromType(fileType: string): "png" | "jpg" | null {
  if (fileType === "image/png") return "png";
  if (fileType === "image/jpeg") return "jpg";
  return null;
}

export function isSupportedLogoFile(file: { type: string; size: number }): { ok: true } | { ok: false; error: string } {
  const extension = logoExtensionFromType(file.type);
  if (!extension || !ALLOWED_LOGO_TYPES.has(file.type)) {
    return { ok: false, error: "Logo must be a PNG or JPEG image." };
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return { ok: false, error: "Logo size must be 2MB or less." };
  }

  return { ok: true };
}
