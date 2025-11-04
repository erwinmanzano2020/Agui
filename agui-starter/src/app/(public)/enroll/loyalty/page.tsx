"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { z } from "@/lib/z";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

const schema = z.object({
  brandOrCode: z.string().min(2, "Enter a brand name or code"),
  contact: z.string().min(4, "Phone or email is required"),
});

type FormData = {
  brandOrCode: string;
  contact: string;
};

const createInitialData = (): FormData => ({
  brandOrCode: "",
  contact: "",
});

export default function EnrollLoyaltyPage() {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [data, setData] = useState<FormData>(createInitialData);

  const handleChange = <Key extends keyof FormData>(key: Key) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setData((current: FormData) => ({ ...current, [key]: value }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const submission = {
      brandOrCode: data.brandOrCode.trim(),
      contact: data.contact.trim(),
    } satisfies FormData;

    const parsed = schema.safeParse(submission);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? "Check your input";
      toast.error(firstError);
      return;
    }

    setPending(true);
    try {
      const identifierKind = submission.contact.includes("@")
        ? "email"
        : submission.contact.match(/^\+?\d{7,}$/)
          ? "phone"
          : undefined;

      const response = await fetch("/api/applications/enroll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifierKind,
          rawValue: submission.contact,
          meta: {
            brandOrCode: submission.brandOrCode,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.error === "string" ? payload.error : "Failed to submit";
        toast.error(message);
        return;
      }

      toast.success("Enrollment request sent. We’ll text/email you updates.");
      setData(createInitialData());
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold">Enroll to a Loyalty Pass</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="enroll-loyalty-brand">
            Brand Name or Code
          </label>
          <Input
            id="enroll-loyalty-brand"
            value={data.brandOrCode}
            onChange={handleChange("brandOrCode")}
            placeholder="e.g., VANGIE / VANGIE-123"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="enroll-loyalty-contact">
            Your Phone or Email
          </label>
          <Input
            id="enroll-loyalty-contact"
            value={data.contact}
            onChange={handleChange("contact")}
            placeholder="09xx... or you@email.com"
            autoComplete="email"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Submitting..." : "Send request"}
        </Button>
      </form>
    </main>
  );
}
