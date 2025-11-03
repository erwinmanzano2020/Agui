"use client";

import { useState } from "react";

import type { ApplicationType } from "@/lib/roles/types";

const APPLICATION_TYPES: { value: ApplicationType; label: string }[] = [
  { value: "customer", label: "Customer (Loyalty Pass)" },
  { value: "employee", label: "Employee" },
  { value: "owner", label: "Business Owner" },
  { value: "admin", label: "System Admin" },
  { value: "gm", label: "Game Master" },
];

export default function ApplyPage() {
  const [email, setEmail] = useState("");
  const [type, setType] = useState<ApplicationType>("customer");
  const [brandSlug, setBrandSlug] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (status === "submitting") {
      return;
    }

    setStatus("submitting");
    setMessage(null);

    const response = await fetch("/api/applications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim(), type, brandSlug: brandSlug.trim() || null }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (response.ok) {
      setStatus("success");
      setMessage("Application submitted. We’ll reach out once it’s reviewed.");
      setEmail("");
      setBrandSlug("");
      return;
    }

    setStatus("error");
    setMessage(payload.error ?? "Failed to submit application.");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-12">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold text-foreground">Apply for access</h1>
        <p className="text-sm text-muted-foreground">
          Tell us how you’d like to use Agui and we’ll review your request.
        </p>
      </header>

      <section className="rounded-2xl border border-border/80 bg-card p-6 shadow-soft">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="apply-email">
              Email
            </label>
            <input
              id="apply-email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-border px-3 py-2 text-base text-foreground outline-none focus:border-primary"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="apply-type">
              Application type
            </label>
            <select
              id="apply-type"
              className="w-full rounded-md border border-border px-3 py-2 text-base text-foreground"
              value={type}
              onChange={(event) => setType(event.target.value as ApplicationType)}
            >
              {APPLICATION_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="apply-brand">
              Brand (optional)
            </label>
            <input
              id="apply-brand"
              placeholder="e.g. vangie-store"
              className="w-full rounded-md border border-border px-3 py-2 text-base text-foreground outline-none focus:border-primary"
              value={brandSlug}
              onChange={(event) => setBrandSlug(event.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "submitting" ? "Submitting…" : "Submit application"}
          </button>

          {message ? (
            <p className={`text-sm ${status === "error" ? "text-destructive" : "text-emerald-600"}`}>{message}</p>
          ) : null}
        </form>
      </section>
    </main>
  );
}
