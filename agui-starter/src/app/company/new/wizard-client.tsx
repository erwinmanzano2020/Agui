"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { slugify } from "@/lib/slug";

import { createBusinessWizard, type BusinessCreationWizardResult } from "./actions";

const BUSINESS_TYPE_OPTIONS = [
  { value: "grocery", label: "Grocery" },
  { value: "cafe", label: "Café" },
  { value: "laundry", label: "Laundry" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "restaurant", label: "Restaurant" },
  { value: "services", label: "Services" },
  { value: "retail", label: "Retail" },
];

type WizardFormState = {
  name: string;
  slug: string;
  businessType: string;
  logoUrl: string;
  slogan: string;
};

type FieldErrors = Partial<Record<keyof WizardFormState | "form", string | null>>;

type WizardStep = 0 | 1 | 2 | 3;

type BusinessCreationWizardProps = {
  hadWorkspacesBefore: boolean;
};

function StepIndicator({ step }: { step: WizardStep }) {
  const steps = ["Business info", "Roles", "Review"];
  const activeIndex = step === 3 ? 2 : step;

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      {steps.map((label, index) => {
        const current = index === activeIndex;
        const completed = index < activeIndex;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium ${
                completed
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                  : current
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background"
              }`}
            >
              {index + 1}
            </div>
            <span className={current ? "text-foreground" : ""}>{label}</span>
            {index < steps.length - 1 ? <span className="text-border">/</span> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function BusinessCreationWizard({ hadWorkspacesBefore }: BusinessCreationWizardProps) {
  const [step, setStep] = useState<WizardStep>(0);
  const [formState, setFormState] = useState<WizardFormState>(() => ({
    name: "",
    slug: "",
    businessType: BUSINESS_TYPE_OPTIONS[0]!.value,
    logoUrl: "",
    slogan: "",
  }));
  const [autoSlug, setAutoSlug] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<BusinessCreationWizardResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (autoSlug) {
      setFormState((prev) => ({ ...prev, slug: slugify(prev.name || "") }));
    }
  }, [autoSlug, formState.name]);

  const slugPreview = useMemo(() => formState.slug.trim() || slugify(formState.name || ""), [formState.slug, formState.name]);

  const disableNextStep = useMemo(() => {
    if (step !== 0) return false;
    return formState.name.trim().length === 0 || slugPreview.length === 0;
  }, [formState.name, slugPreview, step]);

  useEffect(() => {
    setErrors({});
  }, [step]);

  const handleFieldChange = (field: keyof WizardFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
    if (field === "name" && autoSlug) {
      setFormState((prev) => ({ ...prev, slug: slugify(value) }));
    }
    if (field === "slug") {
      setAutoSlug(false);
    }
  };

  const goToRoles = () => {
    if (disableNextStep) {
      setErrors((prev) => ({ ...prev, name: !formState.name ? "Business name is required" : null, slug: !slugPreview ? "Slug is required" : null }));
      return;
    }
    setStep(1);
  };

  const goToReview = () => {
    setStep(2);
  };

  const resetWizard = () => {
    setStep(0);
    setResult(null);
  };

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const payload = {
        name: formState.name,
        slug: slugPreview,
        businessType: formState.businessType,
        logoUrl: formState.logoUrl,
        slogan: formState.slogan,
      };
      const response = await createBusinessWizard(payload);
      if (response.status === "success") {
        setResult(response);
        setStep(3);
      } else {
        setResult(response);
        setErrors({ ...response.fieldErrors, form: response.formError });
        setStep((prev) => (prev === 3 ? 2 : prev));
      }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <StepIndicator step={step} />
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          {step === 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="business-name" className="text-sm font-medium text-foreground">
                  Business name
                </label>
                <Input
                  id="business-name"
                  value={formState.name}
                  onChange={(event) => handleFieldChange("name", event.target.value)}
                  placeholder="Vangie Variety Store"
                  autoComplete="organization"
                  required
                />
                <p className="text-xs text-muted-foreground">This appears on dashboards, receipts, and staff tools.</p>
                {errors.name ? <p className="text-xs text-destructive">{errors.name}</p> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="business-slug" className="text-sm font-medium text-foreground">
                  Workspace URL
                </label>
                <Input
                  id="business-slug"
                  value={formState.slug}
                  onChange={(event) => handleFieldChange("slug", event.target.value)}
                  onBlur={() => handleFieldChange("slug", slugify(formState.slug || formState.name))}
                  placeholder="vangie-variety-store"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">We’ll auto-generate if you leave this blank.</p>
                {errors.slug ? <p className="text-xs text-destructive">{errors.slug}</p> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="business-type" className="text-sm font-medium text-foreground">
                  Business type
                </label>
                <select
                  id="business-type"
                  value={formState.businessType}
                  onChange={(event) => handleFieldChange("businessType", event.target.value)}
                  className="h-10 w-full rounded-[var(--agui-radius)] border border-border bg-background px-3 text-sm text-foreground"
                >
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="business-logo" className="text-sm font-medium text-foreground">
                  Logo URL (optional)
                </label>
                <Input
                  id="business-logo"
                  value={formState.logoUrl}
                  onChange={(event) => handleFieldChange("logoUrl", event.target.value)}
                  placeholder="https://example.com/logo.png"
                  inputMode="url"
                  autoComplete="url"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="business-slogan" className="text-sm font-medium text-foreground">
                  Slogan or description (optional)
                </label>
                <textarea
                  id="business-slogan"
                  value={formState.slogan}
                  onChange={(event) => handleFieldChange("slogan", event.target.value)}
                  className="min-h-[88px] w-full rounded-[var(--agui-radius)] border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="Friendly neighborhood grocer since 1998"
                />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Roles & ownership</h2>
              <p className="text-sm text-muted-foreground">
                You’ll be assigned as the <span className="font-medium">Business Owner</span> and <span className="font-medium">Business Admin</span> for this workspace.
              </p>
              <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-4 text-sm">
                Invite staff and branch managers in the next release. For now, you’ll control access from the workspace settings.
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Review & confirm</h2>
                <p className="text-sm text-muted-foreground">Double-check details before creating your business workspace.</p>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Business name</dt>
                  <dd className="text-sm font-medium text-foreground">{formState.name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Workspace URL</dt>
                  <dd className="text-sm font-medium text-foreground">/{slugPreview || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Type</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {BUSINESS_TYPE_OPTIONS.find((option) => option.value === formState.businessType)?.label ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Slogan</dt>
                  <dd className="text-sm font-medium text-foreground">{formState.slogan || "—"}</dd>
                </div>
              </dl>
              {formState.logoUrl ? (
                <div className="space-y-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Logo</dt>
                  <dd>
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={formState.logoUrl} alt="Business logo preview" className="h-full w-full object-cover" />
                    </div>
                  </dd>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 3 && result?.status === "success" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Business created!</h2>
                <p className="text-sm text-muted-foreground">We set up your workspace and granted you owner access.</p>
              </div>
              <div className="rounded-xl border border-border bg-background/60 p-4">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Business</dt>
                    <dd className="text-sm font-medium text-foreground">{result.business.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Workspace URL</dt>
                    <dd className="text-sm font-medium text-foreground">
                      /company/{result.business.slug ?? result.business.id}
                    </dd>
                  </div>
                  {result.branch ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">Default branch</dt>
                      <dd className="text-sm font-medium text-foreground">{result.branch.name}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {errors.form ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errors.form}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {step === 0 ? (
          <p className="text-xs text-muted-foreground">
            {hadWorkspacesBefore
              ? "Creating another business won’t show the Start a business tile."
              : "This is your first workspace. We’ll remove the tile once you’re set."}
          </p>
        ) : step === 3 ? null : (
          <Button variant="ghost" onClick={() => setStep((prev) => (prev > 0 ? ((prev - 1) as WizardStep) : prev))}>
            Back
          </Button>
        )}

        <div className="flex items-center gap-2">
          {step === 0 ? (
            <Button onClick={goToRoles} disabled={disableNextStep}>
              Next
            </Button>
          ) : null}
          {step === 1 ? (
            <Button onClick={goToReview}>Review</Button>
          ) : null}
          {step === 2 ? (
            <Button onClick={submit} disabled={pending}>
              {pending ? "Creating…" : "Create business"}
            </Button>
          ) : null}
          {step === 3 && result?.status === "success" ? (
            <div className="flex items-center gap-2">
              <Button asChild>
                <Link href={`/company/${result.business.slug ?? result.business.id}`}>Go to dashboard</Link>
              </Button>
              <Button variant="outline" disabled>
                Add branch (soon)
              </Button>
              <Button variant="outline" disabled>
                Invite staff (soon)
              </Button>
              <Button variant="ghost" onClick={resetWizard}>
                Create another
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
