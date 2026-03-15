"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/auth/client";
import type { WorkspaceSettings } from "@/lib/settings/workspace";

import { getLogoUrlWarning, LOGO_BUCKET, uploadBrandingLogo } from "./branding-logo-upload";

type WorkspaceSettingsFormProps = {
  businessSlug: string;
  businessId: string;
  initialValues: WorkspaceSettings;
  canEdit: boolean;
};

type BrandingState = {
  brandName: string;
  logoUrl: string;
};

function toBrandingState(settings: WorkspaceSettings): BrandingState {
  return {
    brandName: settings.branding.brandName ?? "",
    logoUrl: settings.branding.logoUrl ?? "",
  };
}

export default function WorkspaceSettingsForm({ businessSlug, businessId, initialValues, canEdit }: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [branding, setBranding] = React.useState<BrandingState>(() => toBrandingState(initialValues));
  const [savingBranding, setSavingBranding] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const [brandingStatus, setBrandingStatus] = React.useState<"idle" | "success" | "error">("idle");
  const [brandingError, setBrandingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setBranding(toBrandingState(initialValues));
  }, [initialValues]);

  const brandingDisabled = savingBranding || uploadingLogo || !canEdit;

  const saveBranding = React.useCallback(async () => {
    setSavingBranding(true);
    setBrandingStatus("idle");
    setBrandingError(null);

    try {
      const response = await fetch(`/company/${businessSlug}/settings/branding`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandName: branding.brandName,
          logoUrl: branding.logoUrl,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        branding?: { brandName: string | null; logoUrl: string | null };
        error?: { message?: string };
      };

      if (!response.ok) {
        setBrandingStatus("error");
        setBrandingError(body.error?.message ?? "Unable to save branding.");
        setSavingBranding(false);
        return;
      }

      if (body.branding) {
        setBranding({
          brandName: body.branding.brandName ?? "",
          logoUrl: body.branding.logoUrl ?? "",
        });
      }

      setBrandingStatus("success");
      setSavingBranding(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      setBrandingStatus("error");
      setBrandingError(error instanceof Error ? error.message : "Unable to save branding.");
      setSavingBranding(false);
    }
  }, [branding, businessSlug, router]);

  const persistUploadedLogoUrl = React.useCallback(
    async (logoUrl: string) => {
      const response = await fetch(`/company/${businessSlug}/settings/branding`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ logoUrl }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        branding?: { brandName: string | null; logoUrl: string | null };
        error?: { message?: string };
      };

      if (!response.ok) {
        throw new Error(body.error?.message ?? "Unable to save branding.");
      }

      if (body.branding) {
        setBranding((prev) => ({
          ...prev,
          brandName: body.branding?.brandName ?? prev.brandName,
          logoUrl: body.branding?.logoUrl ?? logoUrl,
        }));
      }
    },
    [businessSlug],
  );

  const uploadLogo = React.useCallback(
    async (file: File) => {
      setUploadingLogo(true);
      setBrandingStatus("idle");
      setBrandingError(null);

      try {
        const storage = supabase.storage.from(LOGO_BUCKET);
        const result = await uploadBrandingLogo({
          storage,
          businessId,
          file,
          persistLogoUrl: persistUploadedLogoUrl,
        });

        setBranding((prev) => ({ ...prev, logoUrl: result.logoUrl }));
      } catch (error) {
        console.error(error);
        setBrandingStatus("error");
        setBrandingError(error instanceof Error ? error.message : "Unable to upload logo.");
      } finally {
        setUploadingLogo(false);
      }
    },
    [businessId, persistUploadedLogoUrl],
  );

  const onLogoFileChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadLogo(file);
      event.target.value = "";
    },
    [uploadLogo],
  );

  const logoPreviewUrl = branding.logoUrl.trim();
  const logoUrlWarning = getLogoUrlWarning(branding.logoUrl);

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          You can preview settings, but only workspace owners or admins can make changes.
        </div>
      )}

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">Branding</h2>
          <p className="text-sm text-muted-foreground">Brand identity shown across business views and staff IDs.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {brandingError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {brandingError}
            </p>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Brand name</label>
            <Input
              value={branding.brandName}
              onChange={(event) => setBranding((prev) => ({ ...prev, brandName: event.target.value }))}
              placeholder="If empty, uses workspace name"
              disabled={brandingDisabled}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Logo upload</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={onLogoFileChange}
              className="hidden"
              disabled={brandingDisabled}
            />
            <Button
              type="button"
              variant="outline"
              disabled={brandingDisabled}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingLogo ? "Uploading…" : "Upload logo"}
            </Button>
            <p className="text-xs text-muted-foreground">PNG or JPEG only, up to 2MB.</p>
            {logoPreviewUrl && (
              <div className="rounded-md border p-2 w-fit">
                <img
                  src={logoPreviewUrl}
                  alt="Workspace logo preview"
                  className="h-16 w-auto max-w-56 object-contain"
                />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Logo URL</label>
            <Input
              value={branding.logoUrl}
              onChange={(event) => setBranding((prev) => ({ ...prev, logoUrl: event.target.value }))}
              placeholder="https://example.com/logo.png"
              disabled={brandingDisabled}
            />
            <p className="text-xs text-muted-foreground">Any http(s) image URL is allowed.</p>
            {logoUrlWarning && <p className="text-xs text-amber-700">{logoUrlWarning}</p>}
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" disabled={brandingDisabled} onClick={saveBranding}>
              {savingBranding ? "Saving…" : "Save branding"}
            </Button>
            {brandingStatus === "success" && <span className="text-sm text-emerald-700">Branding saved.</span>}
            {brandingStatus === "error" && !brandingError && (
              <span className="text-sm text-destructive">Unable to save branding.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <h2 className="text-lg font-semibold">Other settings</h2>
          <p className="text-sm text-muted-foreground">Not available yet in preview.</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Labels, receipt defaults, SOP, POS defaults, and other workspace settings are temporarily disabled while
            settings storage is being finalized.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
