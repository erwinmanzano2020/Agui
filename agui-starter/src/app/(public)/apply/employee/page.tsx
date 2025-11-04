"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { z } from "@/lib/z";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";

const schema = z.object({
  employerName: z.string().min(2, "Employer name is required"),
  contact: z.string().min(4, "Phone or email is required"),
  note: z.string().optional(),
});

type FormData = {
  employerName: string;
  contact: string;
  note?: string;
};

const createInitialData = (): FormData => ({
  employerName: "",
  contact: "",
  note: "",
});

export default function ApplyEmployeePage() {
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
      employerName: data.employerName.trim(),
      contact: data.contact.trim(),
      note: data.note?.trim() ? data.note.trim() : undefined,
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

      const response = await fetch("/api/applications/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: "employment",
          identifierKind,
          rawValue: submission.contact,
          meta: {
            employerName: submission.employerName,
            note: submission.note,
          },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload.error === "string" ? payload.error : "Failed to submit";
        toast.error(message);
        return;
      }

      toast.success("Application received. We’ll review and get back to you.");
      setData(createInitialData());
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6 p-6">
      <h1 className="text-xl font-semibold">Apply as Employee</h1>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="apply-employee-employer">
            Employer / Business
          </label>
          <Input
            id="apply-employee-employer"
            value={data.employerName}
            onChange={handleChange("employerName")}
            placeholder="e.g., Vangie Store"
            autoComplete="organization"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="apply-employee-contact">
            Your Phone or Email
          </label>
          <Input
            id="apply-employee-contact"
            value={data.contact}
            onChange={handleChange("contact")}
            placeholder="09xx... or you@email.com"
            autoComplete="email"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="apply-employee-note">
            Note (optional)
          </label>
          <Input
            id="apply-employee-note"
            value={data.note ?? ""}
            onChange={handleChange("note")}
            placeholder="Anything we should know?"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Submitting..." : "Submit application"}
        </Button>
      </form>
    </main>
  );
}
