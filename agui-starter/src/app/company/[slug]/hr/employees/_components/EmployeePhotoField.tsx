"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { buildEmployeePhotoPath, EMPLOYEE_PHOTOS_BUCKET } from "@/lib/hr/employee-photo";
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
const DEBUG_EVENT_HISTORY_LIMIT = 24;
const STORAGE_ERROR_PREFIX = "Uploading photo failed.";
const NO_AUTO_RETRY_TIMEOUT_MESSAGE = "Storage request timed out and may still be running. Please retry once.";

type CropDraft = {
  blob: Blob;
  previewUrl: string;
  imageBitmap: ImageBitmap;
  zoom: number;
  panX: number;
  panY: number;
  rotation: 0 | 90 | 180 | 270;
};

type PhotoPipelinePhase = "IDLE" | "PREPARING" | "RENDERING_CROP" | "UPLOADING_STORAGE" | "PERSISTING_RECORD" | "SUCCESS" | "FAILED";

type PhotoDebugEvent = {
  at: string;
  event: string;
  phase: PhotoPipelinePhase;
  message?: string;
};

function createOperationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `photo-op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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


function getPathContract(path: string, employeeId: string) {
  const canonicalPath = buildEmployeePhotoPath(employeeId);
  const duplicateBucketPrefix = `${EMPLOYEE_PHOTOS_BUCKET}/${EMPLOYEE_PHOTOS_BUCKET}/`;
  return {
    canonicalPath,
    isCanonicalPath: path === canonicalPath,
    hasDuplicateBucketPrefix: path.startsWith(duplicateBucketPrefix),
    bucket: EMPLOYEE_PHOTOS_BUCKET,
    objectKey: path,
  };
}


type StorageProbeClient = {
  storage: {
    from: (bucket: string) => {
      list: (
        path: string,
        options: { limit: number; search: string },
      ) => Promise<{ data: Array<{ name: string }> | null; error: { message: string; statusCode?: number } | null }>;
    };
  };
};

type ProbeOutcome =
  | { status: "exists" }
  | { status: "not_found" }
  | { status: "error"; error: { message: string; statusCode: number | null } };

type UploadPrimitive = "upload" | "update" | "server_upload";

async function probeObjectExists(supabase: StorageProbeClient, employeeId: string) {
  const targetName = `${employeeId}.jpg`;
  const { data, error } = await supabase.storage.from("employee-photos").list("employee-photos", {
    limit: 10,
    search: targetName,
  });

  if (error) {
    return {
      status: "error" as const,
      error: {
        message: error.message,
        statusCode: (error as { statusCode?: number }).statusCode ?? null,
      },
    };
  }

  const exists = Boolean(data?.some((item: { name: string }) => item.name === targetName));
  return exists ? ({ status: "exists" as const }) : ({ status: "not_found" as const });
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
  operationId: string,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-photo-operation-id": operationId },
      body: JSON.stringify({ houseId, operationId, ...payload }),
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
    statusCode: response.status,
    photoUrl: body?.photo_url ?? payload.photo_url,
    photoPath: body?.photo_path ?? payload.photo_path,
  };
}

async function deleteEmployeePhotoViaApi(employeeId: string, houseId: string, operationId: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), API_PERSIST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-photo-operation-id": operationId },
      body: JSON.stringify({ houseId, operationId }),
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


async function uploadEmployeePhotoViaServerApi(
  employeeId: string,
  houseId: string,
  blob: Blob,
  path: string,
  operationId: string,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const formData = new FormData();
  formData.append("houseId", houseId);
  formData.append("operationId", operationId);
  formData.append("path", path);
  formData.append("contentType", "image/jpeg");
  formData.append("file", blob, "photo.jpg");

  let response: Response;
  try {
    response = await fetch(`/api/hr/employees/${employeeId}/photo/upload`, {
      method: "POST",
      headers: { "x-photo-operation-id": operationId },
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Photo upload timed out. Please try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }

  const body = (await response.json().catch(() => null)) as { error?: string; path?: string } | null;
  if (!response.ok || !body?.path) {
    throw new Error(body?.error || "Server upload failed");
  }

  return body.path;
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
  const [phase, setPhase] = useState<PhotoPipelinePhase>("IDLE");
  const [operationId, setOperationId] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [processedBlobSize, setProcessedBlobSize] = useState<number | null>(null);
  const [targetStoragePath, setTargetStoragePath] = useState<string | null>(null);
  const [debugEvents, setDebugEvents] = useState<PhotoDebugEvent[]>([]);
  const [modalCloseTriggered, setModalCloseTriggered] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const streamRef = useRef<MediaStream | null>(null);
  const countdownTimeoutRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const uploadRequestIdRef = useRef(0);
  const uploadGuardTimeoutRef = useRef<number | null>(null);
  const cropDraftRequestIdRef = useRef(0);
  const dragStateRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const phaseRef = useRef<PhotoPipelinePhase>("IDLE");
  const operationIdRef = useRef<string | null>(null);
  const processedBlobSizeRef = useRef<number | null>(null);
  const targetStoragePathRef = useRef<string | null>(null);
  const modalCloseTriggeredRef = useRef(false);
  const expectedDraftClearRef = useRef(false);
  const hadCropDraftRef = useRef(false);
  const uploadInvocationRef = useRef(0);
  const pendingStorageAttemptIdsRef = useRef<Set<string>>(new Set());
  const lastInitialSyncRef = useRef<string | null>(null);

  const explicitDebugMode = searchParams.get("debug") === "1";
  const showDebugPanel = explicitDebugMode;
  const debugStorageKey = `hr-photo-debug-events:${employeeId}`;
  const debugUploadModeParam = searchParams.get("photoUploadMode");
  const defaultUploadMode = persistToEmployeeRecord ? "server" : "client";
  const storageUploadMode = explicitDebugMode && debugUploadModeParam === "client"
    ? "client"
    : defaultUploadMode;


  useEffect(() => {
    phaseRef.current = phase;
    operationIdRef.current = operationId;
    processedBlobSizeRef.current = processedBlobSize;
    targetStoragePathRef.current = targetStoragePath;
    modalCloseTriggeredRef.current = modalCloseTriggered;
  }, [modalCloseTriggered, operationId, phase, processedBlobSize, targetStoragePath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showDebugPanel) {
      setDebugEvents([]);
      return;
    }

    const raw = window.sessionStorage.getItem(debugStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PhotoDebugEvent[];
      setDebugEvents(Array.isArray(parsed) ? parsed.slice(-DEBUG_EVENT_HISTORY_LIMIT) : []);
    } catch {
      window.sessionStorage.removeItem(debugStorageKey);
    }
  }, [debugStorageKey, showDebugPanel]);

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
    setPhase("IDLE");
  }, [clearUploadGuardTimeout]);

  const pushDebugEvent = useCallback(
    (nextEvent: string, nextPhase: PhotoPipelinePhase, extra: Record<string, unknown> = {}, message?: string) => {
      const entry: PhotoDebugEvent = { at: new Date().toISOString(), event: nextEvent, phase: nextPhase, message };
      if (showDebugPanel) {
        setDebugEvents((current) => {
          const next = [...current, entry].slice(-DEBUG_EVENT_HISTORY_LIMIT);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(debugStorageKey, JSON.stringify(next));
          }
          return next;
        });
      }

      if (message) {
        setLastError(message);
      }

      setPhase(nextPhase);
      if (showDebugPanel || nextPhase === "FAILED") {
        console.info("[hr][employee-photo] phase", {
          employeeId,
          houseId: houseId ?? null,
          operationId: operationIdRef.current,
          phase: nextPhase,
          processedBlobSize: processedBlobSizeRef.current,
          targetStoragePath: targetStoragePathRef.current,
          modalCloseTriggered: modalCloseTriggeredRef.current,
          ...extra,
          message: message ?? null,
        });
      }
    },
    [debugStorageKey, employeeId, houseId, showDebugPanel],
  );

  const clearDraft = useCallback((reason: string, expected = true) => {
    pushDebugEvent("clearDraft:called", phaseRef.current, { reason, expected });
    expectedDraftClearRef.current = expected;
    invalidateCropDraftFlow();
    invalidateUploadFlow();
    clearDraftState();
    pushDebugEvent("clearDraft:done", "IDLE", { reason, expected });
  }, [clearDraftState, invalidateCropDraftFlow, invalidateUploadFlow, pushDebugEvent]);

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

  const resetCameraFlow = useCallback((reason: string) => {
    pushDebugEvent("resetCameraFlow:called", phaseRef.current, { reason });
    stopCamera();
    setCameraOpen(false);
    invalidateCropDraftFlow();
    invalidateUploadFlow();
  }, [invalidateCropDraftFlow, invalidateUploadFlow, pushDebugEvent, stopCamera]);

  useEffect(() => {
    return () => {
      pushDebugEvent("component:unmount", phaseRef.current, { employeeId });
      stopCamera();
      clearDraft("component_unmount", true);
      invalidateUploadFlow();
      clearUploadGuardTimeout();
    };
  }, [clearDraft, clearUploadGuardTimeout, employeeId, invalidateUploadFlow, pushDebugEvent, stopCamera]);

  useEffect(() => {
    const snapshot = JSON.stringify({ employeeId, initialPhotoUrl: initialPhotoUrl ?? null, initialPhotoPath: initialPhotoPath ?? null });
    if (lastInitialSyncRef.current === snapshot) {
      return;
    }
    lastInitialSyncRef.current = snapshot;

    pushDebugEvent("effect:reset_from_initial_props", "IDLE", {
      employeeId,
      initialPhotoUrlPresent: Boolean(initialPhotoUrl),
      initialPhotoPathPresent: Boolean(initialPhotoPath),
    });
    setPhotoUrl(initialPhotoUrl);
    setPhotoPath(initialPhotoPath);
    resetCameraFlow("initial_props_change");
    clearDraft("initial_props_change", true);
    setError(null);
    setPhase("IDLE");
    setOperationId(null);
    setLastError(null);
    setProcessedBlobSize(null);
    setTargetStoragePath(null);
    setModalCloseTriggered(false);
  }, [clearDraft, employeeId, initialPhotoPath, initialPhotoUrl, pushDebugEvent, resetCameraFlow]);

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

  const uploadBlob = async (blob: Blob, currentOperationId: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return false;
    }

    const requestId = uploadRequestIdRef.current + 1;
    const uploadInvocation = uploadInvocationRef.current + 1;
    uploadInvocationRef.current = uploadInvocation;
    uploadRequestIdRef.current = requestId;
    setOperationId(currentOperationId);
    clearUploadGuardTimeout();
    uploadGuardTimeoutRef.current = window.setTimeout(() => {
      if (uploadRequestIdRef.current === requestId) {
        pushDebugEvent("uploadBlob:guard_timeout", "FAILED", { requestId, uploadInvocation, pendingStorageRequests: pendingStorageAttemptIdsRef.current.size }, "Upload guard timeout reached before request settled.");
        setError("Upload guard timeout reached before request settled.");
        setUploading(false);
      }
    }, MAX_UPLOAD_TIMEOUT_MS * UPLOAD_MAX_ATTEMPTS + RETRY_BACKOFF_MS + 3_000);

    setUploading(true);
    setError(null);
    pushDebugEvent("uploadBlob:start", "UPLOADING_STORAGE", {
      blobSize: blob.size,
      operationId: currentOperationId,
      requestId,
      uploadInvocation,
      uploadMode: storageUploadMode,
    });
    setLastError(null);

    try {
      const previousPath = photoPath;
      let attempt = 0;
      let lastError: unknown = null;

      while (attempt < UPLOAD_MAX_ATTEMPTS) {
        attempt += 1;

        if (storageUploadMode === "server" && !houseId) {
          throw new Error("Missing house context for server upload mode.");
        }

        const path = buildEmployeePhotoPath(employeeId);
        const pathContract = getPathContract(path, employeeId);
        const attemptTimeout = getUploadTimeoutMs(blob, attempt);
        const attemptStartedAt = Date.now();
        const attemptId = `${currentOperationId}-r${requestId}-i${uploadInvocation}-a${attempt}`;
        let timeoutId: number | null = null;
        let responseReturned = false;
        let staleAtCompletion = false;
        let selectedPrimitiveForAttempt: UploadPrimitive = storageUploadMode === "server" ? "server_upload" : "upload";

        pendingStorageAttemptIdsRef.current.add(attemptId);
        setTargetStoragePath(path);

        try {
          pushDebugEvent("storageUpload:start", "UPLOADING_STORAGE", {
            operationId: currentOperationId,
            employeeId,
            targetPath: path,
            attempt,
            blobSize: blob.size,
            timeoutMs: attemptTimeout,
            timeoutAt: new Date(attemptStartedAt + attemptTimeout).toISOString(),
            startAt: new Date(attemptStartedAt).toISOString(),
            uploadMode: storageUploadMode,
            pathContract,
            overwriteHintFromState: previousPath === path,
            requestId,
            uploadInvocation,
            attemptId,
          });

          const overwriteHintFromState = previousPath === path;
          const hasKnownPhotoInState = Boolean(previousPath || photoUrl);
          let probeAttempted = false;
          let probeOutcome: ProbeOutcome | null = null;
          let selectedPrimitive: UploadPrimitive;

          if (storageUploadMode === "server") {
            selectedPrimitive = "server_upload";
          } else if (overwriteHintFromState || hasKnownPhotoInState) {
            selectedPrimitive = "update";
          } else {
            probeAttempted = true;
            pushDebugEvent("storageProbe:start", "UPLOADING_STORAGE", {
              operationId: currentOperationId,
              employeeId,
              targetPath: path,
            });
            probeOutcome = await probeObjectExists(supabase, employeeId);
            if (probeOutcome.status === "exists") {
              selectedPrimitive = "update";
              pushDebugEvent("storageProbe:exists", "UPLOADING_STORAGE", {
                operationId: currentOperationId,
                employeeId,
                targetPath: path,
              });
            } else if (probeOutcome.status === "not_found") {
              selectedPrimitive = "upload";
              pushDebugEvent("storageProbe:not_found", "UPLOADING_STORAGE", {
                operationId: currentOperationId,
                employeeId,
                targetPath: path,
              });
            } else {
              pushDebugEvent("storageProbe:error", "FAILED", {
                operationId: currentOperationId,
                employeeId,
                targetPath: path,
                error: probeOutcome.error,
              }, "Unable to determine storage overwrite strategy because storage probe failed.");
              throw new Error("Unable to determine upload strategy. Please retry.");
            }
          }

          pushDebugEvent("storageUpload:strategy_selected", "UPLOADING_STORAGE", {
            operationId: currentOperationId,
            employeeId,
            targetPath: path,
            knownPhotoPath: previousPath,
            knownPhotoUrlPresent: Boolean(photoUrl),
            overwriteHintFromState,
            probeAttempted,
            probeOutcome,
            selectedStrategy: selectedPrimitive,
          });

          selectedPrimitiveForAttempt = selectedPrimitive;

          const uploadPromise = storageUploadMode === "server"
            ? (pushDebugEvent("storageUpload:primitive_server_upload", "UPLOADING_STORAGE", {
                operationId: currentOperationId,
                employeeId,
                targetPath: path,
              }), uploadEmployeePhotoViaServerApi(employeeId, houseId ?? "", blob, path, currentOperationId, attemptTimeout).then(() => ({ data: { path }, error: null as null | Error })))
            : selectedPrimitive === "update"
              ? (pushDebugEvent("storageUpload:primitive_update", "UPLOADING_STORAGE", {
                  operationId: currentOperationId,
                  employeeId,
                  targetPath: path,
                }), supabase.storage.from("employee-photos").update(path, blob, {
                  contentType: "image/jpeg",
                }).then((result) => {
                  if (result.error && result.error.message.toLowerCase().includes("not found")) {
                    pushDebugEvent("storageUpload:primitive_upload", "UPLOADING_STORAGE", {
                      operationId: currentOperationId,
                      employeeId,
                      targetPath: path,
                      fallback: "update_not_found",
                    });
                    return supabase.storage.from("employee-photos").upload(path, blob, {
                      contentType: "image/jpeg",
                      upsert: false,
                    });
                  }
                  return result;
                }))
              : (pushDebugEvent("storageUpload:primitive_upload", "UPLOADING_STORAGE", {
                  operationId: currentOperationId,
                  employeeId,
                  targetPath: path,
                }), supabase.storage.from("employee-photos").upload(path, blob, {
                  contentType: "image/jpeg",
                  upsert: false,
                }));

          void uploadPromise.finally(() => {
            pendingStorageAttemptIdsRef.current.delete(attemptId);
            pushDebugEvent("storageUpload:settled", "UPLOADING_STORAGE", {
              attemptId,
              operationId: currentOperationId,
              requestId,
              uploadInvocation,
              pendingStorageRequests: pendingStorageAttemptIdsRef.current.size,
            });
          });

          const uploadResult = await Promise.race([
            uploadPromise,
            new Promise<never>((_, reject) => {
              timeoutId = window.setTimeout(() => {
                reject(new Error("Photo upload timed out. Please try again."));
              }, attemptTimeout);
            }),
          ]);

          responseReturned = true;
          staleAtCompletion = uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation;

          pushDebugEvent("storageUpload:response", "UPLOADING_STORAGE", {
            operationId: currentOperationId,
            employeeId,
            targetPath: path,
            attempt,
            blobSize: blob.size,
            timeoutMs: attemptTimeout,
            timeoutAt: new Date(attemptStartedAt + attemptTimeout).toISOString(),
            startAt: new Date(attemptStartedAt).toISOString(),
            uploadMode: storageUploadMode,
            endAt: new Date().toISOString(),
            durationMs: Date.now() - attemptStartedAt,
            responseReturned,
            staleAtCompletion,
            requestId,
            uploadInvocation,
            attemptId,
            supportsAbort: false,
            settledLaterObserved: false,
            pathContract,
            primitiveTried: selectedPrimitiveForAttempt,
            storageErrorMessage: uploadResult.error?.message ?? null,
            storageErrorStatusCode: typeof (uploadResult.error as { statusCode?: unknown } | null)?.statusCode === "number"
              ? ((uploadResult.error as { statusCode?: unknown }).statusCode as number)
              : null,
          });

          if (uploadResult.error) {
            throw uploadResult.error;
          }

          pushDebugEvent("storageUpload:success", "UPLOADING_STORAGE", { path, blobSize: blob.size, attempt });

          if (staleAtCompletion) {
            pushDebugEvent("uploadBlob:stale_request_after_storage", "FAILED", { requestId, operationId: currentOperationId, uploadInvocation }, "Upload request became stale before persistence.");
            setError("Upload request became stale before persistence.");
            return false;
          }

          const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
          const resolvedPhotoUrl = `${data.publicUrl}?t=${Date.now()}`;
          pushDebugEvent("storageUpload:public_url", "UPLOADING_STORAGE", {
            path,
            publicUrl: resolvedPhotoUrl,
            pathContract,
          });

          if (persistToEmployeeRecord) {
            if (!houseId) {
              throw new Error("Missing house context for photo update.");
            }

            pushDebugEvent("persistApi:start", "PERSISTING_RECORD", {
              path,
              blobSize: blob.size,
              timeoutMs: API_PERSIST_TIMEOUT_MS,
              operationId: currentOperationId,
            });
            const persisted = await persistEmployeePhotoViaApi(employeeId, houseId, {
              photo_url: resolvedPhotoUrl,
              photo_path: path,
            }, API_PERSIST_TIMEOUT_MS, currentOperationId);

            if (uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation) {
              pushDebugEvent("uploadBlob:stale_request_after_persist", "FAILED", { requestId, operationId: currentOperationId, uploadInvocation }, "Upload request became stale after API persist.");
              setError("Upload request became stale after API persist.");
              return false;
            }

            setPhotoUrl(persisted.photoUrl);
            setPhotoPath(persisted.photoPath);
            pushDebugEvent("persistApi:success", "SUCCESS", {
              photoPath: persisted.photoPath,
              statusCode: persisted.statusCode,
            });
            router.refresh();
          } else {
            setPhotoUrl(resolvedPhotoUrl);
            setPhotoPath(path);
            pushDebugEvent("persistApi:skipped", "SUCCESS", { reason: "persistToEmployeeRecord=false" });
          }

          if (previousPath && previousPath !== path) {
            void supabase.storage.from("employee-photos").remove([previousPath]).then(({ error: removeError }) => {
              if (removeError) {
                pushDebugEvent("storageCleanup:previous_path_failed", "FAILED", { previousPath, message: removeError.message }, removeError.message);
                return;
              }
              pushDebugEvent("storageCleanup:previous_path_success", "SUCCESS", { previousPath });
            });
          }

          return true;
        } catch (attemptError) {
          lastError = attemptError;
          staleAtCompletion = uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation;
          const attemptMessage = attemptError instanceof Error ? attemptError.message : String(attemptError);

          pushDebugEvent("storageUpload:error", "FAILED", {
            operationId: currentOperationId,
            employeeId,
            targetPath: path,
            attempt,
            blobSize: blob.size,
            timeoutMs: attemptTimeout,
            timeoutAt: new Date(attemptStartedAt + attemptTimeout).toISOString(),
            startAt: new Date(attemptStartedAt).toISOString(),
            uploadMode: storageUploadMode,
            endAt: new Date().toISOString(),
            durationMs: Date.now() - attemptStartedAt,
            responseReturned,
            staleAtCompletion,
            requestId,
            uploadInvocation,
            attemptId,
            supportsAbort: false,
            errorName: attemptError instanceof Error ? attemptError.name : null,
            errorCode: typeof (attemptError as { code?: unknown })?.code === "string" ? (attemptError as { code: string }).code : null,
            errorStatusCode: typeof (attemptError as { statusCode?: unknown })?.statusCode === "number" ? (attemptError as { statusCode: number }).statusCode : null,
            pathContract,
            primitiveTried: selectedPrimitiveForAttempt,
            message: attemptMessage,
          }, attemptMessage);

          if (uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation) {
            pushDebugEvent("uploadBlob:stale_request_after_attempt_error", "FAILED", { requestId, operationId: currentOperationId, uploadInvocation }, "Upload request became stale after a failed attempt.");
            setError("Upload request became stale after a failed attempt.");
            return false;
          }

          const isFinalAttempt = attempt >= UPLOAD_MAX_ATTEMPTS;
          if (isTimeoutError(attemptError)) {
            pushDebugEvent("storageUpload:timeout_orphan_possible", "FAILED", {
              attemptId,
              pendingStorageRequests: pendingStorageAttemptIdsRef.current.size,
              note: "Supabase upload promise may still be unresolved; skipping auto-retry to avoid overlapping uploads.",
              uploadMode: storageUploadMode,
            }, NO_AUTO_RETRY_TIMEOUT_MESSAGE);
            break;
          }

          if (isFinalAttempt) {
            break;
          }

          await wait(RETRY_BACKOFF_MS);
        } finally {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }
        }
      }

      if (uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation) {
        pushDebugEvent("uploadBlob:stale_request_after_retries", "FAILED", { requestId, operationId: currentOperationId, uploadInvocation }, "Upload request became stale after retries.");
        setError("Upload request became stale after retries.");
        return false;
      }

      if (isTimeoutError(lastError)) {
        const timeoutMessage = lastError instanceof Error ? lastError.message : "Photo upload timed out. Please try again.";
        throw new Error(`${NO_AUTO_RETRY_TIMEOUT_MESSAGE} ${timeoutMessage}`);
      }

      throw lastError instanceof Error ? lastError : new Error("Failed to upload photo");
    } catch (uploadError) {
      if (uploadRequestIdRef.current !== requestId || uploadInvocationRef.current !== uploadInvocation) {
        pushDebugEvent("uploadBlob:stale_request_in_catch", "FAILED", { requestId, operationId: currentOperationId, uploadInvocation }, "Upload request became stale while handling an error.");
        setError("Upload request became stale while handling an error.");
        return false;
      }

      const reason = uploadError instanceof Error ? uploadError.message : "Failed to upload photo";
      const contextualMessage = `${STORAGE_ERROR_PREFIX} ${reason}`;
      setError(contextualMessage);
      pushDebugEvent("uploadBlob:error", "FAILED", { reason, phase: "UPLOADING_STORAGE", requestId, uploadInvocation }, contextualMessage);
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
      pushDebugEvent("beginCrop:start", "PREPARING", { blobSize: blob.size });
      invalidateCropDraftFlow();
      const requestId = cropDraftRequestIdRef.current;
      expectedDraftClearRef.current = true;
      clearDraftState();

      const imageBitmap = await createImageBitmap(blob);
      pushDebugEvent("beginCrop:imageBitmap_ready", "PREPARING", { blobSize: blob.size, requestId });
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

      pushDebugEvent("beginCrop:set_draft", "PREPARING", { requestId, blobSize: blob.size });
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
      pushDebugEvent("beginCrop:ready", "PREPARING", { blobSize: blob.size });
    },
    [clearDraftState, invalidateCropDraftFlow, pushDebugEvent],
  );

  const onUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    pushDebugEvent("onUploadFile:start", "PREPARING");
    const file = event.target.files?.[0];
    if (!file) {
      pushDebugEvent("onUploadFile:no_file", "FAILED", {}, "No file selected.");
      return;
    }

    pushDebugEvent("onUploadFile:file_selected", "PREPARING", { fileType: file.type, fileSize: file.size });

    const currentOperationId = createOperationId();
    setOperationId(currentOperationId);
    pushDebugEvent("selectImage", "PREPARING", { operationId: currentOperationId, fileType: file.type, fileSize: file.size });

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    try {
      pushDebugEvent("prepareImage:start", "PREPARING", { operationId: currentOperationId, fileSize: file.size });
      const normalized = await toJpegBlob(file);
      pushDebugEvent("onUploadFile:normalized_success", "PREPARING", { normalizedSize: normalized.size });
      await beginCrop(normalized);
      pushDebugEvent("openCrop:success", "PREPARING", { operationId: currentOperationId, preparedBlobSize: normalized.size });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Unable to open selected image.";
      setError(message);
      pushDebugEvent("onUploadFile:normalized_failure", "FAILED", { operationId: currentOperationId }, message);
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
    pushDebugEvent("captureFromCamera:start", "PREPARING");
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

    pushDebugEvent("captureFromCamera:blob_ready", "PREPARING", { blobSize: blob.size });

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
      const skippedReason = !cropDraft ? "missing_crop_draft" : "already_uploading";
      pushDebugEvent("confirmCrop:skipped", phase, { skippedReason });
      return;
    }

    const currentOperationId = operationId ?? createOperationId();
    setOperationId(currentOperationId);
    setModalCloseTriggered(false);
    setUploading(true);
    setError(null);
    pushDebugEvent("confirmCrop:start", "PREPARING", { operationId: currentOperationId });

    try {
      pushDebugEvent("renderPortraitCrop:start", "RENDERING_CROP", { operationId: currentOperationId });
      const processedBlob = await renderPortraitCrop(cropDraft);
      setProcessedBlobSize(processedBlob.size);
      pushDebugEvent("renderPortraitCrop:success", "RENDERING_CROP", {
        operationId: currentOperationId,
        blobSize: processedBlob.size,
      });

      const didUpload = await uploadBlob(processedBlob, currentOperationId);
      if (!didUpload) {
        pushDebugEvent("confirmCrop:upload_not_completed", "FAILED", { operationId: currentOperationId });
        return;
      }

      pushDebugEvent("confirmCrop:success", "SUCCESS", { operationId: currentOperationId });
      setModalCloseTriggered(true);
      clearDraft("confirmCrop_success", true);
      resetCameraFlow("confirmCrop_success");
      pushDebugEvent("modal:close_after_success", "SUCCESS", {
        operationId: currentOperationId,
        blobSize: processedBlob.size,
      });
      toast.success("Employee photo saved.");
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Unable to save cropped photo.";
      const contextualMessage = `Failed during ${phaseRef.current}: ${message}`;
      setError(contextualMessage);
      pushDebugEvent("confirmCrop:error", "FAILED", { operationId: currentOperationId }, contextualMessage);
    } finally {
      setUploading(false);
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


  useEffect(() => {
    if (cropDraft) {
      hadCropDraftRef.current = true;
      pushDebugEvent("modal:open", phaseRef.current, { hasDraft: true });
      return;
    }

    if (hadCropDraftRef.current && !expectedDraftClearRef.current && phaseRef.current !== "SUCCESS" && phaseRef.current !== "IDLE") {
      const message = "Photo selection was reset before cropping completed.";
      setError(message);
      pushDebugEvent("cropDraft:unexpected_clear", "FAILED", {}, message);
    }

    if (!cropDraft) {
      hadCropDraftRef.current = false;
    }

    expectedDraftClearRef.current = false;
  }, [cropDraft, pushDebugEvent]);

  const deletePhoto = async () => {
    const existingPath = photoPath;
    const previousPhotoUrl = photoUrl;
    const previousPhotoPath = photoPath;
    const currentOperationId = createOperationId();
    setOperationId(currentOperationId);

    clearDraft("deletePhoto_start", true);
    invalidateUploadFlow();
    setError(null);
    setUploading(true);
    pushDebugEvent("delete:preparing", "PREPARING", { hasExistingPath: Boolean(existingPath), operationId: currentOperationId });
    pushDebugEvent("delete:start", "PREPARING", { operationId: currentOperationId, hasExistingPath: Boolean(existingPath) });

    if (!persistToEmployeeRecord) {
      setPhotoUrl(null);
      setPhotoPath(null);
    }

    if (persistToEmployeeRecord) {
      if (!houseId) {
        setError("Photo removed from form, but missing house context to persist deletion.");
        setUploading(false);
        return;
      }

      try {
        await deleteEmployeePhotoViaApi(employeeId, houseId, currentOperationId);
        setPhotoUrl(null);
        setPhotoPath(null);
        pushDebugEvent("delete:persist_success", "SUCCESS", { operationId: currentOperationId });
        router.refresh();
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : "Unable to persist photo deletion right now.";
        setPhotoUrl(previousPhotoUrl);
        setPhotoPath(previousPhotoPath);
        setError(message);
        pushDebugEvent("delete:persist_error", "FAILED", { operationId: currentOperationId }, message);
        setUploading(false);
        return;
      }
    }

    if (!existingPath) {
      toast.success("Employee photo removed.");
      pushDebugEvent("delete:no_storage_path", "SUCCESS");
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

    pushDebugEvent("delete:path_contract", "PREPARING", {
      removePath: existingPath,
      pathContract: getPathContract(existingPath, employeeId),
    });

    const { error: removeError } = await supabase.storage.from("employee-photos").remove([existingPath]);
    if (removeError) {
      setError("Photo reference cleared, but storage cleanup failed. It can be overwritten by next upload.");
      pushDebugEvent("delete:storage_cleanup_failed", "FAILED", { operationId: currentOperationId }, "storage_cleanup_failed");
      setUploading(false);
      return;
    }

    pushDebugEvent("delete:storage_success", "SUCCESS", { operationId: currentOperationId, path: existingPath });
    toast.success("Employee photo removed.");
    setUploading(false);
  };

  const closeCropEditor = () => {
    clearDraft("closeCropEditor", true);
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
            <Button type="button" variant="ghost" onClick={() => resetCameraFlow("camera_cancel_button")} disabled={countdown !== null}>
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
          {phase === "RENDERING_CROP"
            ? "Rendering cropped photo…"
            : phase === "UPLOADING_STORAGE"
              ? "Uploading photo…"
              : phase === "PERSISTING_RECORD"
                ? "Saving employee record…"
                : "Preparing photo…"}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {showDebugPanel ? (
        <div className="rounded-md border border-dashed border-border/70 bg-muted/20 p-2 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground/80">Photo pipeline debug (enabled)</p>
          <p>operationId: {operationId ?? "—"}</p>
          <p>phase: {phase}</p>
          <p>lastError: {lastError ?? "—"}</p>
          <p>processedBlobSize: {processedBlobSize ?? "—"}</p>
          <p>targetStoragePath: {targetStoragePath ?? "—"}</p>
          <p>modalCloseTriggered: {String(modalCloseTriggered)}</p>
          <ul className="mt-1 space-y-0.5 border-t border-border/60 pt-1">
            {debugEvents.length === 0 ? <li>no events yet</li> : null}
            {debugEvents.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                {entry.at} — {entry.event} ({entry.phase}){entry.message ? `: ${entry.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {cropDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(96vw,820px)] rounded-xl border border-border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Align Employee Portrait</h3>
                <p className="text-xs text-muted-foreground">Use the off-center guides for Agui ID framing before saving.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={closeCropEditor} disabled={uploading}>
                Close
              </Button>
            </div>

            {error ? <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">{error}</p> : null}

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
                  <Button type="button" variant="ghost" onClick={closeCropEditor} disabled={uploading}>
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
