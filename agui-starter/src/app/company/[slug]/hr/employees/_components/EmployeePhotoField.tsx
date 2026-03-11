"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildEmployeePhotoPath } from "@/lib/hr/employee-photo";
import { getSupabase } from "@/lib/supabase";

type Props = {
  employeeId: string;
  initialPhotoUrl?: string | null;
  initialPhotoPath?: string | null;
  label?: string;
};

const PORTRAIT_FRAME_WIDTH = 240;
const PORTRAIT_FRAME_HEIGHT = 320;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 960;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const UPLOAD_TIMEOUT_MS = 45_000;

type CropDraft = {
  blob: Blob;
  previewUrl: string;
  imageBitmap: ImageBitmap;
  zoom: number;
  panX: number;
  panY: number;
};

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
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92);
  });

  if (!blob) {
    throw new Error("Unable to prepare image for crop.");
  }

  return blob;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPanBounds(imageBitmap: ImageBitmap, zoom: number) {
  const coverScale = Math.max(PORTRAIT_FRAME_WIDTH / imageBitmap.width, PORTRAIT_FRAME_HEIGHT / imageBitmap.height);
  const renderedWidth = imageBitmap.width * coverScale * zoom;
  const renderedHeight = imageBitmap.height * coverScale * zoom;
  const maxPanX = Math.max(0, (renderedWidth - PORTRAIT_FRAME_WIDTH) / 2);
  const maxPanY = Math.max(0, (renderedHeight - PORTRAIT_FRAME_HEIGHT) / 2);
  return { coverScale, renderedWidth, renderedHeight, maxPanX, maxPanY };
}

async function renderPortraitCrop(draft: CropDraft): Promise<Blob> {
  const { imageBitmap, zoom, panX, panY } = draft;
  const { renderedWidth, renderedHeight } = getPanBounds(imageBitmap, zoom);

  const left = PORTRAIT_FRAME_WIDTH / 2 - renderedWidth / 2 + panX;
  const top = PORTRAIT_FRAME_HEIGHT / 2 - renderedHeight / 2 + panY;

  const scaleX = renderedWidth / imageBitmap.width;
  const scaleY = renderedHeight / imageBitmap.height;

  const sourceX = clamp((-left) / scaleX, 0, imageBitmap.width - 1);
  const sourceY = clamp((-top) / scaleY, 0, imageBitmap.height - 1);
  const sourceWidth = clamp(PORTRAIT_FRAME_WIDTH / scaleX, 1, imageBitmap.width - sourceX);
  const sourceHeight = clamp(PORTRAIT_FRAME_HEIGHT / scaleY, 1, imageBitmap.height - sourceY);

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to render cropped photo.");
  }

  context.drawImage(
    imageBitmap,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    OUTPUT_WIDTH,
    OUTPUT_HEIGHT,
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9);
  });

  if (!blob) {
    throw new Error("Unable to save cropped image.");
  }

  return blob;
}

export function EmployeePhotoField({ employeeId, initialPhotoUrl = null, initialPhotoPath = null, label = "Employee Photo" }: Props) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoPath, setPhotoPath] = useState(initialPhotoPath);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const uploadRequestIdRef = useRef(0);
  const dragStateRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearDraft = useCallback(() => {
    setCropDraft((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
        current.imageBitmap.close();
      }
      return null;
    });
  }, []);

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

  const invalidateUploadFlow = useCallback(() => {
    uploadRequestIdRef.current += 1;
    setUploading(false);
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearTimers();
  }, [clearTimers]);

  const resetCameraFlow = useCallback(() => {
    stopCamera();
    setCameraOpen(false);
    invalidateUploadFlow();
  }, [invalidateUploadFlow, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
      clearDraft();
      invalidateUploadFlow();
    };
  }, [clearDraft, invalidateUploadFlow, stopCamera]);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl);
    setPhotoPath(initialPhotoPath);
    resetCameraFlow();
    clearDraft();
    setError(null);
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
    setUploading(true);
    setError(null);

    let timeoutId: number | null = null;

    try {
      const path = buildEmployeePhotoPath(employeeId);
      const uploadPromise = supabase.storage.from("employee-photos").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });

      const uploadResult = await Promise.race([
        uploadPromise,
        new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(() => {
            reject(new Error("Photo upload timed out. Please try again."));
          }, UPLOAD_TIMEOUT_MS);
        }),
      ]);

      if (uploadResult.error) {
        throw uploadResult.error;
      }

      if (uploadRequestIdRef.current !== requestId) {
        return false;
      }

      const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
      setPhotoUrl(`${data.publicUrl}?t=${Date.now()}`);
      setPhotoPath(path);
      return true;
    } catch (uploadError) {
      if (uploadRequestIdRef.current !== requestId) {
        return false;
      }

      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload photo";
      setError(message);
      return false;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      if (uploadRequestIdRef.current === requestId) {
        setUploading(false);
      }
    }
  };

  const beginCrop = useCallback(
    async (blob: Blob) => {
      clearDraft();
      const imageBitmap = await createImageBitmap(blob);
      const previewUrl = URL.createObjectURL(blob);
      setCropDraft({ blob, previewUrl, imageBitmap, zoom: 1, panX: 0, panY: 0 });
      setError(null);
    },
    [clearDraft],
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
      const processedBlob = await renderPortraitCrop(cropDraft);
      const didUpload = await uploadBlob(processedBlob);
      if (!didUpload) return;
      clearDraft();
      resetCameraFlow();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to save cropped photo.");
    }
  };

  const onZoomChange = (value: number) => {
    setCropDraft((current) => {
      if (!current) return current;
      const nextZoom = clamp(value, MIN_ZOOM, MAX_ZOOM);
      const bounds = getPanBounds(current.imageBitmap, nextZoom);
      return {
        ...current,
        zoom: nextZoom,
        panX: clamp(current.panX, -bounds.maxPanX, bounds.maxPanX),
        panY: clamp(current.panY, -bounds.maxPanY, bounds.maxPanY),
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
      const bounds = getPanBounds(current.imageBitmap, current.zoom);
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

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          Upload a portrait image first, then crop and align before saving. Camera capture remains available.
        </p>
      </div>

      <input type="hidden" name="photo_url" value={photoUrl ?? ""} />
      <input type="hidden" name="photo_path" value={photoPath ?? ""} />

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

      {cropDraft ? (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">Pan to align and use zoom to frame the portrait before saving.</p>
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
                width: getPanBounds(cropDraft.imageBitmap, cropDraft.zoom).renderedWidth,
                height: getPanBounds(cropDraft.imageBitmap, cropDraft.zoom).renderedHeight,
                transform: `translate(calc(-50% + ${cropDraft.panX}px), calc(-50% + ${cropDraft.panY}px))`,
              }}
            />
          </div>

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
            <Button type="button" onClick={() => void confirmCrop()} disabled={uploading}>
              Save Cropped Photo
            </Button>
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              Choose Another Image
            </Button>
            <Button type="button" variant="ghost" disabled={uploading} onClick={clearDraft}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

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
      {uploading ? <p className="text-xs text-muted-foreground">Uploading processed photo…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
