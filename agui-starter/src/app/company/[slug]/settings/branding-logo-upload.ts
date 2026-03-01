export const LOGO_BUCKET = "house-assets";
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = new Set(["image/png", "image/jpeg"]);

const UPLOAD_TIMEOUT_MS = 30_000;
const DRIVE_VIEW_LINK_PATTERN = /^https?:\/\/(?:www\.)?drive\.google\.com\/.+\/view(?:\?.*)?$/i;

type StorageUploadResult = { error: { message?: string } | null };
type StorageRemoveResult = { error: { message?: string } | null };

type StorageBucketClient = {
  remove(paths: string[]): Promise<StorageRemoveResult>;
  upload(path: string, file: File, options: { upsert: boolean; contentType: string; cacheControl: string }): Promise<StorageUploadResult>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
};

type UploadLogoInput = {
  storage: StorageBucketClient;
  businessId: string;
  file: File;
  persistLogoUrl: (logoUrl: string) => Promise<void>;
  timeoutMs?: number;
};

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

export function getLogoUrlWarning(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (DRIVE_VIEW_LINK_PATTERN.test(trimmed)) {
    return "This looks like a web page link; please use a direct PNG/JPG URL or upload a file.";
  }

  return null;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function uploadBrandingLogo(input: UploadLogoInput): Promise<{ logoUrl: string }> {
  const validation = isSupportedLogoFile(input.file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const extension = logoExtensionFromType(input.file.type);
  if (!extension) {
    throw new Error("Logo must be a PNG or JPEG image.");
  }

  const path = `houses/${input.businessId}/branding/logo.${extension}`;

  if (process.env.NODE_ENV !== "production") {
    console.debug("[branding.logoUpload]", {
      bucket: LOGO_BUCKET,
      path,
      fileName: input.file.name,
      fileType: input.file.type,
      fileSize: input.file.size,
    });
  }

  const removePaths = ["png", "jpg", "jpeg"]
    .filter((candidate) => candidate !== extension)
    .map((candidate) => `houses/${input.businessId}/branding/logo.${candidate}`);

  await input.storage.remove(removePaths);

  const uploadResult = await withTimeout(
    input.storage.upload(path, input.file, {
      upsert: true,
      contentType: input.file.type,
      cacheControl: "3600",
    }),
    input.timeoutMs ?? UPLOAD_TIMEOUT_MS,
    "Upload timed out, please retry.",
  );

  if (uploadResult.error) {
    throw new Error(toErrorMessage(uploadResult.error, "Unable to upload logo."));
  }

  const { data } = input.storage.getPublicUrl(path);
  const logoUrl = data.publicUrl;

  await input.persistLogoUrl(logoUrl);

  return { logoUrl };
}
