"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { buildEmployeePhotoPath } from "@/lib/hr/employee-photo";
import { getSupabase } from "@/lib/supabase";

type Props = {
  employeeId: string;
  initialPhotoUrl?: string | null;
  initialPhotoPath?: string | null;
  label?: string;
  includeHiddenInputs?: boolean;
  persistToEmployeeRecord?: boolean;
  houseId?: string;
};

const PORTRAIT_FRAME_WIDTH = 240;
const PORTRAIT_FRAME_HEIGHT = 320;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 960;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const BASE_UPLOAD_TIMEOUT_MS = 60_000;
const MAX_UPLOAD_TIMEOUT_MS = 150_000;
const UPLOAD_TIMEOUT_PER_MB_MS = 20_000;
const UPLOAD_MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 900;
const API_PERSIST_TIMEOUT_MS = 20_000;
const DEFAULT_INITIAL_ZOOM = 1.15;
const DEFAULT_INITIAL_PAN_X = -10;
const DEFAULT_INITIAL_PAN_Y = 0;

type CropDraft = {
  blob: Blob;
  previewUrl: string;
  imageBitmap: ImageBitmap;
  zoom: number;
  panX: number;
  panY: number;
  rotation: 0 | 90 | 180 | 270;
};

type PhotoPipelinePhase =
  | "idle"
  | "preparing"
  | "rendering"
  | "uploading"
  | "saving"
  | "removing"
  | "done"
  | "failed";

async function toJpegBlob(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process uploaded image.");
  }

  context.drawImage(image, 0, 0, image.width, image.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9);
  });

  image.close();

  if (!blob) {
    throw new Error("Unable to prepare image for crop.");
  }

  return blob;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.message === "Photo upload timed out. Please try again.";
}

function getUploadTimeoutMs(blob: Blob, attempt: number): number {
  const blobMb = blob.size / (1024 * 1024);
  const computed = BASE_UPLOAD_TIMEOUT_MS + blobMb * UPLOAD_TIMEOUT_PER_MB_MS + (attempt - 1) * 15_000;
  return Math.round(clamp(computed, BASE_UPLOAD_TIMEOUT_MS, MAX_UPLOAD_TIMEOUT_MS));
}

function getNormalizedRotation(rotation: number): 0 | 90 | 180 | 270 {
  const normalized = ((rotation % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

function getSourceDimensions(imageBitmap: ImageBitmap, rotation: 0 | 90 | 180 | 270) {
  if (rotation === 90 || rotation === 270) {
    return { width: imageBitmap.height, height: imageBitmap.width };
  }
  return { width: imageBitmap.width, height: imageBitmap.height };
}

function getPanBounds(imageBitmap: ImageBitmap, zoom: number, rotation: 0 | 90 | 180 | 270) {
  const source = getSourceDimensions(imageBitmap, rotation);
  const coverScale = Math.max(PORTRAIT_FRAME_WIDTH / source.width, PORTRAIT_FRAME_HEIGHT / source.height);
  const renderedWidth = source.width * coverScale * zoom;
  const renderedHeight = source.height * coverScale * zoom;
  const maxPanX = Math.max(0, (renderedWidth - PORTRAIT_FRAME_WIDTH) / 2);
  const maxPanY = Math.max(0, (renderedHeight - PORTRAIT_FRAME_HEIGHT) / 2);
  return { renderedWidth, renderedHeight, maxPanX, maxPanY };
}

async function buildRotatedCanvas(imageBitmap: ImageBitmap, rotation: 0 | 90 | 180 | 270): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process rotated image.");
  }

  if (rotation === 90 || rotation === 270) {
    canvas.width = imageBitmap.height;
    canvas.height = imageBitmap.width;
  } else {
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
  }

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(imageBitmap, -imageBitmap.width / 2, -imageBitmap.height / 2);
  context.setTransform(1, 0, 0, 1, 0, 0);

  return canvas;
}

async function renderPortraitCrop(draft: CropDraft): Promise<Blob> {
  const { imageBitmap, zoom, panX, panY, rotation } = draft;
  const rotatedSource = await buildRotatedCanvas(imageBitmap, rotation);
  const rotatedWidth = rotatedSource.width;
  const rotatedHeight = rotatedSource.height;
  const { renderedWidth, renderedHeight } = getPanBounds(imageBitmap, zoom, rotation);

  const left = PORTRAIT_FRAME_WIDTH / 2 - renderedWidth / 2 + panX;
  const top = PORTRAIT_FRAME_HEIGHT / 2 - renderedHeight / 2 + panY;

  const scaleX = renderedWidth / rotatedWidth;
  const scaleY = renderedHeight / rotatedHeight;

  const sourceX = clamp((-left) / scaleX, 0, rotatedWidth - 1);
  const sourceY = clamp((-top) / scaleY, 0, rotatedHeight - 1);
  const sourceWidth = clamp(PORTRAIT_FRAME_WIDTH / scaleX, 1, rotatedWidth - sourceX);
  const sourceHeight = clamp(PORTRAIT_FRAME_HEIGHT / scaleY, 1, rotatedHeight - sourceY);

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to render cropped photo.");
  }

  context.drawImage(rotatedSource, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("Unable to save cropped image.");
  }

  return blob;
}

async function persistEmployeePhotoViaApi(
  employeeId: string,
  houseId: string,
  payload: { photo_url: string | null; photo_path: string | null },
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseId, ...payload }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Saving employee record timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => null)) as {
    error?: string;
    photo_url?: string | null;
    photo_path?: string | null;
  } | null;

  if (!response.ok) {
    throw new Error(body?.error || "Unable to persist employee photo");
  }

  return {
    photoUrl: body?.photo_url ?? payload.photo_url,
    photoPath: body?.photo_path ?? payload.photo_path,
  };
}

async function deleteEmployeePhotoViaApi(employeeId: string, houseId: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_PERSIST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ houseId }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Removing employee record photo timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(body?.error || "Unable to delete employee photo");
  }
}

export function EmployeePhotoField({
  employeeId,
  initialPhotoUrl = null,
  initialPhotoPath = null,
  label = "Employee Photo",
  includeHiddenInputs = true,
  persistToEmployeeRecord = false,
  houseId,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoPath, setPhotoPath] = useState(initialPhotoPath);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<PhotoPipelinePhase>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();
  const toast = useToast();
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const uploadRequestIdRef = useRef(0);
  const uploadGuardTimeoutRef = useRef<number | null>(null);
  const cropDraftRequestIdRef = useRef(0);
  const dragStateRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const invalidateCropDraftFlow = useCallback(() => {
    cropDraftRequestIdRef.current += 1;
  }, []);

  const clearUploadGuardTimeout = useCallback(() => {
    if (uploadGuardTimeoutRef.current !== null) {
      window.clearTimeout(uploadGuardTimeoutRef.current);
      uploadGuardTimeoutRef.current = null;
    }
  }, []);

  const clearDraftState = useCallback(() => {
    setCropDraft((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
        current.imageBitmap.close();
      }
      return null;
    });
  }, []);

  const invalidateUploadFlow = useCallback(() => {
    uploadRequestIdRef.current += 1;
    clearUploadGuardTimeout();
    setUploading(false);
    setPhase("idle");
  }, [clearUploadGuardTimeout]);

  const setPhaseWithLog = useCallback(
    (nextPhase: PhotoPipelinePhase, extra: Record<string, unknown> = {}) => {
      setPhase(nextPhase);
      console.info("[hr][employee-photo] phase", { employeeId, houseId: houseId ?? null, phase: nextPhase, ...extra });
    },
    [employeeId, houseId],
  );

  const clearDraft = useCallback(() => {
    invalidateCropDraftFlow();
    invalidateUploadFlow();
    clearDraftState();
  }, [clearDraftState, invalidateCropDraftFlow, invalidateUploadFlow]);

  const clearTimers = useCallback(() => {
    setCountdown(null);
    setFlashVisible(false);

    if (countdownTimeoutRef.current) {
      window.clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }

    if (flashTimeoutRef.current) {
      window.clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearTimers();
  }, [clearTimers]);

  const resetCameraFlow = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    invalidateCropDraftFlow();
    invalidateUploadFlow();
  }, [invalidateCropDraftFlow, invalidateUploadFlow, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      clearDraft();
      invalidateUploadFlow();
      clearUploadGuardTimeout();
    };
  }, [clearDraft, clearUploadGuardTimeout, invalidateUploadFlow, stopCamera]);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl);
    setPhotoPath(initialPhotoPath);
    resetCameraFlow();
    clearDraft();
    setError(null);
    setPhase("idle");
  }, [clearDraft, employeeId, initialPhotoPath, initialPhotoUrl, resetCameraFlow]);

  useEffect(() => {
    if (!cameraOpen || !streamRef.current || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;
    void videoElement.play().catch(() => {
      setError("Unable to start camera preview. Please try again.");
    });
  }, [cameraOpen]);

  const uploadBlob = async (blob: Blob) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return false;
    }

    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    clearUploadGuardTimeout();
    uploadGuardTimeoutRef.current = window.setTimeout(() => {
      if (uploadRequestIdRef.current === requestId) {
        setUploading(false);
      }
    }, MAX_UPLOAD_TIMEOUT_MS * UPLOAD_MAX_ATTEMPTS + RETRY_BACKOFF_MS + 3_000);

    setUploading(true);
    setError(null);
    setPhaseWithLog("uploading", { blobSize: blob.size });

    try {
      const path = buildEmployeePhotoPath(employeeId);
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt < UPLOAD_MAX_ATTEMPTS) {
        attempt += 1;
        let timeoutId: number | null = null;

        try {
          const uploadPromise = supabase.storage.from("employee-photos").upload(path, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });

          const uploadResult = await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) => {
              const attemptTimeout = getUploadTimeoutMs(blob, attempt);
              console.info("[hr][employee-photo] storage upload attempt", {
                employeeId,
                houseId: houseId ?? null,
                attempt,
                blobSize: blob.size,
                attemptTimeout,
              });
              timeoutId = window.setTimeout(() => {
                reject(new Error("Photo upload timed out. Please try again."));
              }, attemptTimeout);
            }),
          ]);

          if (uploadResult.error) {
            throw uploadResult.error;
          }

          if (uploadRequestIdRef.current !== requestId) {
            return false;
          }

          const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
          const resolvedPhotoUrl = `${data.publicUrl}?t=${Date.now()}`;

          if (persistToEmployeeRecord) {
            if (!houseId) {
              throw new Error("Missing house context for photo update.");
            }

            setPhaseWithLog("saving", { blobSize: blob.size, path });
            const persisted = await persistEmployeePhotoViaApi(employeeId, houseId, {
              photo_url: resolvedPhotoUrl,
              photo_path: path,
            }, API_PERSIST_TIMEOUT_MS);

            if (uploadRequestIdRef.current !== requestId) {
              return false;
            }

            setPhotoUrl(persisted.photoUrl);
            setPhotoPath(persisted.photoPath);
            router.refresh();
          } else {
            setPhotoUrl(resolvedPhotoUrl);
            setPhotoPath(path);
          }

          return true;
        } catch (attemptError) {
          lastError = attemptError;

          if (uploadRequestIdRef.current !== requestId) {
            return false;
          }

          const isFinalAttempt = attempt >= UPLOAD_MAX_ATTEMPTS;
          if (!isTimeoutError(attemptError) || isFinalAttempt) {
            break;
          }

          await wait(RETRY_BACKOFF_MS);
        } finally {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
        }
      }

      if (uploadRequestIdRef.current !== requestId) {
        return false;
      }

      throw lastError instanceof Error ? lastError : new Error("Failed to upload photo");
    } catch (uploadError) {
      if (uploadRequestIdRef.current !== requestId) {
        return false;
      }

      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload photo";
      setError(message);
      setPhaseWithLog("failed", { message });
      return false;
    } finally {
      clearUploadGuardTimeout();
      if (uploadRequestIdRef.current === requestId) {
        setUploading(false);
      }
    }
  };

  const beginCrop = useCallback(
    async (blob: Blob) => {
      invalidateCropDraftFlow();
      const requestId = cropDraftRequestIdRef.current;
      clearDraftState();

      const imageBitmap = await createImageBitmap(blob);
      if (cropDraftRequestIdRef.current !== requestId) {
        imageBitmap.close();
        return;
      }

      const previewUrl = URL.createObjectURL(blob);
      if (cropDraftRequestIdRef.current !== requestId) {
        URL.revokeObjectURL(previewUrl);
        imageBitmap.close();
        return;
      }

      setCropDraft({
        blob,
        previewUrl,
        imageBitmap,
        zoom: DEFAULT_INITIAL_ZOOM,
        panX: DEFAULT_INITIAL_PAN_X,
        panY: DEFAULT_INITIAL_PAN_Y,
        rotation: 0,
      });
      setError(null);
      setPhaseWithLog("preparing", { blobSize: blob.size });
    },
    [clearDraftState, invalidateCropDraftFlow, setPhaseWithLog],
  );

  const onUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    try {
      const normalized = await toJpegBlob(file);
      await beginCrop(normalized);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to open selected image.");
    }

    event.target.value = "";
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported by this browser.");
      return;
    }

    stopCamera();
    invalidateUploadFlow();
    setError(null);
    setCameraOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraOpen(false);
      stopCamera();
      setError("Unable to access camera. Check permissions and try again.");
    }
  };

  const captureFromCamera = async () => {
    const video = videoRef.current;
    if (!video) return;

    const sourceWidth = video.videoWidth || 0;
    const sourceHeight = video.videoHeight || 0;
    if (!sourceWidth || !sourceHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to process camera image.");
      return;
    }

    context.translate(sourceWidth, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    context.setTransform(1, 0, 0, 1, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
    });

    if (!blob) {
      setError("Unable to capture image from camera.");
      return;
    }

    stopCamera();
    setCameraOpen(false);
    await beginCrop(blob);
  };

  const startCaptureCountdown = () => {
    if (uploading || countdown !== null || cropDraft) {
      return;
    }

    let nextCount = 3;
    setCountdown(nextCount);

    const runStep = () => {
      if (nextCount <= 1) {
        setCountdown(null);
        setFlashVisible(true);
        flashTimeoutRef.current = window.setTimeout(() => {
          setFlashVisible(false);
          flashTimeoutRef.current = null;
        }, 170);

        void captureFromCamera();
        return;
      }

      nextCount -= 1;
      setCountdown(nextCount);
      countdownTimeoutRef.current = window.setTimeout(runStep, 700);
    };

    countdownTimeoutRef.current = window.setTimeout(runStep, 700);
  };

  const confirmCrop = async () => {
    if (!cropDraft || uploading) {
      return;
    }

    try {
      setPhaseWithLog("rendering");
      const processedBlob = await renderPortraitCrop(cropDraft);
      const didUpload = await uploadBlob(processedBlob);
      if (!didUpload) return;
      clearDraft();
      resetCameraFlow();
      setPhaseWithLog("done", { blobSize: processedBlob.size });
      toast.success("Employee photo saved.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Unable to save cropped photo.";
      setError(message);
      setPhaseWithLog("failed", { message });
    }
  };

  const onZoomChange = (value: number) => {
    setCropDraft((current) => {
      if (!current) return current;
      const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
      const bounds = getPanBounds(current.imageBitmap, nextZoom, current.rotation);
      return {
        ...current,
        zoom: nextZoom,
        panX: clamp(current.panX, -bounds.maxPanX, bounds.maxPanX),
        panY: clamp(current.panY, -bounds.maxPanY, bounds.maxPanY),
      };
    });
  };

  const rotateDraft = (delta: number) => {
    setCropDraft((current) => {
      if (!current) return current;
      const rotation = getNormalizedRotation(current.rotation + delta);
      const bounds = getPanBounds(current.imageBitmap, current.zoom, rotation);
      return {
        ...current,
        rotation,
        panX: clamp(current.panX, -bounds.maxPanX, bounds.maxPanX),
        panY: clamp(current.panY, -bounds.maxPanY, bounds.maxPanY),
      };
    });
  };

  const resetFraming = () => {
    setCropDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        zoom: DEFAULT_INITIAL_ZOOM,
        panX: DEFAULT_INITIAL_PAN_X,
        panY: DEFAULT_INITIAL_PAN_Y,
        rotation: 0,
      };
    });
  };

  const onCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDraft) return;
    dragStateRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cropDraft || !dragStateRef.current) return;

    const deltaX = event.clientX - dragStateRef.current.x;
    const deltaY = event.clientY - dragStateRef.current.y;

    dragStateRef.current = { x: event.clientX, y: event.clientY };

    setCropDraft((current) => {
      if (!current) return current;
      const bounds = getPanBounds(current.imageBitmap, current.zoom, current.rotation);
      return {
        ...current,
        panX: clamp(current.panX + deltaX, -bounds.maxPanX, bounds.maxPanX),
        panY: clamp(current.panY + deltaY, -bounds.maxPanY, bounds.maxPanY),
      };
    });
  };

  const onCropPointerUp = () => {
    dragStateRef.current = null;
  };

  const deletePhoto = async () => {
    const existingPath = photoPath;
    const previousPhotoUrl = photoUrl;
    const previousPhotoPath = photoPath;

    clearDraft();
    invalidateUploadFlow();
    setError(null);
    setUploading(true);
    setPhaseWithLog("removing", { hasExistingPath: Boolean(existingPath) });

    if (!persistToEmployeeRecord) {
      setPhotoUrl(null);
      setPhotoPath(null);
    }

    if (persistToEmployeeRecord) {
      if (!houseId) {
        setError("Photo removed from form, but missing house context to persist deletion.");
        return;
      }

      try {
        await deleteEmployeePhotoViaApi(employeeId, houseId);
        setPhotoUrl(null);
        setPhotoPath(null);
        router.refresh();
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : "Unable to persist photo deletion right now.";
        setPhotoUrl(previousPhotoUrl);
        setPhotoPath(previousPhotoPath);
        setError(message);
        setPhaseWithLog("failed", { message });
        setUploading(false);
        return;
      }
    }

    if (!existingPath) {
      toast.success("Employee photo removed.");
      setPhaseWithLog("done");
      setUploading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setError("Photo reference cleared, but storage cleanup is unavailable in this environment.");
      toast.success("Employee photo removed.");
      setUploading(false);
      return;
    }

    const { error: removeError } = await supabase.storage.from("employee-photos").remove([existingPath]);
    if (removeError) {
      setError("Photo reference cleared, but storage cleanup failed. It can be overwritten by next upload.");
      setPhaseWithLog("failed", { message: "storage_cleanup_failed" });
      setUploading(false);
      return;
    }

    toast.success("Employee photo removed.");
    setPhaseWithLog("done");
    setUploading(false);
  };

  const closeCropEditor = () => {
    clearDraft();
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          Upload a portrait image first, then crop and align before saving. Camera capture remains available.
        </p>
      </div>

      {includeHiddenInputs ? <input type="hidden" name="photo_url" value={photoUrl ?? ""} /> : null}
      {includeHiddenInputs ? <input type="hidden" name="photo_path" value={photoPath ?? ""} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
          onChange={onUploadFile}
          disabled={uploading || cameraOpen}
        />
        <Button type="button" variant="outline" onClick={openCamera} disabled={uploading}>
          Take Photo (Camera)
        </Button>
      </div>

      {cameraOpen ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
          <div className="relative overflow-hidden rounded-md bg-black">
            <video ref={videoRef} className="h-48 w-full scale-x-[-1] object-cover" playsInline muted />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-36 w-28 rounded-md border-2 border-white/65 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />
            </div>
            {countdown !== null ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
                <span className="text-6xl font-semibold tracking-tight text-white drop-shadow">{countdown}</span>
              </div>
            ) : null}
            <div
              className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flashVisible ? "opacity-80" : "opacity-0"}`}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={startCaptureCountdown} disabled={uploading || countdown !== null || Boolean(cropDraft)}>
              {countdown !== null ? "Get Ready..." : "Capture"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCameraFlow} disabled={countdown !== null}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {photoUrl ? <img src={photoUrl} alt="Employee photo preview" className="h-40 w-32 rounded-md object-cover" /> : null}
      {photoUrl || photoPath ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void deletePhoto()} disabled={uploading}>
            Delete Photo
          </Button>
        </div>
      ) : null}
      {uploading ? (
        <p className="text-xs text-muted-foreground">
          {phase === "rendering"
            ? "Rendering cropped photo…"
            : phase === "uploading"
              ? "Uploading photo…"
              : phase === "saving"
                ? "Saving employee record…"
                : phase === "removing"
                  ? "Removing photo…"
                  : "Preparing photo…"}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {cropDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(96vw,820px)] rounded-xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Align Employee Portrait</h3>
                <p className="text-xs text-muted-foreground">Use the off-center guides for Agui ID framing before saving.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeCropEditor}>
                Close
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-[auto,1fr]">
              <div
                className="relative mx-auto overflow-hidden rounded-md border border-border bg-black"
                style={{ width: PORTRAIT_FRAME_WIDTH, height: PORTRAIT_FRAME_HEIGHT }}
                onPointerDown={onCropPointerDown}
                onPointerMove={onCropPointerMove}
                onPointerUp={onCropPointerUp}
                onPointerCancel={onCropPointerUp}
              >
                <img
                  src={cropDraft.previewUrl}
                  alt="Crop preview"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: getPanBounds(cropDraft.imageBitmap, cropDraft.zoom, cropDraft.rotation).renderedWidth,
                    height: getPanBounds(cropDraft.imageBitmap, cropDraft.zoom, cropDraft.rotation).renderedHeight,
                    transform: `translate(calc(-50% + ${cropDraft.panX}px), calc(-50% + ${cropDraft.panY}px)) rotate(${cropDraft.rotation}deg)`,
                  }}
                />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-[8%] right-[8%] top-[8%] border-t border-dashed border-white/65" />
                  <div className="absolute left-[8%] right-[8%] top-[34%] border-t border-white/75" />
                  <div className="absolute left-[8%] right-[8%] top-[68%] border-t border-white/60" />
                  <div className="absolute left-[45%] right-[36%] top-[16%] bottom-[26%] rounded-[999px] border border-white/45" />
                  <div className="absolute left-[30%] right-[18%] top-[60%] bottom-[9%] rounded-[24px] border border-dashed border-white/40" />
                  <div className="absolute bottom-0 left-[52%] top-0 border-l border-white/55" />
                  <div className="absolute inset-[5%] rounded-md border border-white/25" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,transparent_40%,rgba(0,0,0,0.1)_100%)]" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Zoom
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={cropDraft.zoom}
                    onChange={(event) => onZoomChange(Number(event.target.value))}
                    className="w-full"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => rotateDraft(-90)} disabled={uploading}>
                    Rotate Left
                  </Button>
                  <Button type="button" variant="outline" onClick={() => rotateDraft(90)} disabled={uploading}>
                    Rotate Right
                  </Button>
                  <Button type="button" variant="outline" onClick={resetFraming} disabled={uploading}>
                    Reset Framing
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void confirmCrop()} disabled={uploading}>
                    Save Cropped Photo
                  </Button>
                  <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    Choose Another Image
                  </Button>
                  <Button type="button" variant="ghost" onClick={closeCropEditor}>
                    Cancel
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Tip: Align eyes near the upper guide, keep chin above the shoulder box, and keep head slightly right of center for ID framing.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
