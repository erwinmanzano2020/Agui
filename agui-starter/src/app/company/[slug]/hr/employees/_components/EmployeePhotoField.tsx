"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { buildEmployeePhotoPath } from "@/lib/hr/employee-photo";
import { getSupabase } from "@/lib/supabase";

type Props = {
  employeeId: string;
  initialPhotoUrl?: string | null;
  initialPhotoPath?: string | null;
  label?: string;
};

const MAX_IMAGE_DIMENSION = 512;

async function toOptimizedJpeg(file: File): Promise<Blob> {
  const image = await createImageBitmap(file);
  const scale = Math.min(MAX_IMAGE_DIMENSION / image.width, MAX_IMAGE_DIMENSION / image.height, 1);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process uploaded image.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.86);
  });

  if (!blob) {
    throw new Error("Unable to compress uploaded image.");
  }

  return blob;
}

export function EmployeePhotoField({ employeeId, initialPhotoUrl = null, initialPhotoPath = null, label = "Employee Photo" }: Props) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [photoPath, setPhotoPath] = useState(initialPhotoPath);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const uploadBlob = async (blob: Blob) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase is not configured in this environment.");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const path = buildEmployeePhotoPath(employeeId);
      const { error: uploadError } = await supabase.storage.from("employee-photos").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("employee-photos").getPublicUrl(path);
      setPhotoUrl(data.publicUrl);
      setPhotoPath(path);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to upload photo";
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const onUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPEG, or WEBP files are supported.");
      return;
    }

    const optimized = await toOptimizedJpeg(file);
    await uploadBlob(optimized);
    event.target.value = "";
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported by this browser.");
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      setCameraOpen(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
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

    const scale = Math.min(MAX_IMAGE_DIMENSION / sourceWidth, MAX_IMAGE_DIMENSION / sourceHeight, 1);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to process camera image.");
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9);
    });

    if (!blob) {
      setError("Unable to capture image from camera.");
      return;
    }

    await uploadBlob(blob);
    setCameraOpen(false);
    stopCamera();
  };

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Upload or capture a photo (PNG/JPG/WEBP). Images are resized to 512×512 and saved as JPG.</p>
      </div>

      <input type="hidden" name="photo_url" value={photoUrl ?? ""} />
      <input type="hidden" name="photo_path" value={photoPath ?? ""} />

      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onUploadFile} disabled={uploading} />
        <Button type="button" variant="outline" onClick={openCamera} disabled={uploading}>
          Take Photo (Camera)
        </Button>
      </div>

      {cameraOpen ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
          <video ref={videoRef} className="h-48 w-full rounded-md bg-black object-cover" playsInline muted />
          <div className="flex gap-2">
            <Button type="button" onClick={captureFromCamera} disabled={uploading}>Capture</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCameraOpen(false);
                stopCamera();
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {photoUrl ? <img src={photoUrl} alt="Employee photo preview" className="h-32 w-32 rounded-md object-cover" /> : null}
      {uploading ? <p className="text-xs text-muted-foreground">Uploading photo…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
