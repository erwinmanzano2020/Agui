"use client";

import { useEffect, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { type UiTermKey, type UiTerms } from "@/lib/ui-terms";

import { updateUiTerms } from "./actions";

const TERM_FIELDS: Array<{
  key: UiTermKey;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: "alliance",
    label: "Alliance",
    description: "The highest-level organization that can span multiple guilds.",
    placeholder: "Alliance",
  },
  {
    key: "guild",
    label: "Guild",
    description: "A core organization or franchise that houses multiple companies.",
    placeholder: "Guild",
  },
  {
    key: "company",
    label: "Company",
    description: "A business unit or legal entity within a guild.",
    placeholder: "Company",
  },
  {
    key: "team",
    label: "Team",
    description: "Your frontline crew or staff members who run day-to-day operations.",
    placeholder: "Team",
  },
  {
    key: "alliance_pass",
    label: "Alliance Pass",
    description: "The loyalty pass that works across every guild in an alliance.",
    placeholder: "Alliance Pass",
  },
  {
    key: "guild_card",
    label: "Guild Card",
    description: "The membership card for a specific guild and its houses.",
    placeholder: "Guild Card",
  },
  {
    key: "house_pass",
    label: "Patron Pass",
    description: "The loyalty pass for a single house or location.",
    placeholder: "Patron Pass",
  },
];

export function TermsForm({ initialTerms }: { initialTerms: UiTerms }) {
  const [form, setForm] = useState<UiTerms>(initialTerms);
  const [optimisticTerms, applyOptimisticTerms] = useOptimistic(initialTerms, (_, next: UiTerms) => next);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    setForm(initialTerms);
    applyOptimisticTerms(initialTerms);
  }, [applyOptimisticTerms, initialTerms]);

  const handleChange = (key: UiTermKey, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setError(null);
    const payload = { ...form };
    applyOptimisticTerms(payload);

    startTransition(async () => {
      try {
        const result = await updateUiTerms(payload);
        applyOptimisticTerms(result.terms);
        setForm(result.terms);
        if (result.persisted) {
          router.refresh();
          toast.success("UI terms updated across the dashboard.");
        } else {
          toast.warning("Supabase isn’t configured, so changes only persist for this session.");
        }
      } catch (cause) {
        console.error("Failed to update UI terms", cause);
        setError(cause instanceof Error ? cause.message : "Failed to save terms");
        toast.error("Unable to save terms. Please check your Supabase connection and try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {TERM_FIELDS.map((field) => (
          <Card key={field.key}>
            <CardHeader className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">{field.label}</h3>
              <p className="text-sm text-muted-foreground">{field.description}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                name={field.key}
                value={form[field.key] ?? ""}
                placeholder={field.placeholder}
                onChange={(event) => handleChange(field.key, event.target.value)}
                disabled={pending}
              />
              <div className="text-xs text-muted-foreground">
                Preview: <strong>{optimisticTerms[field.key]}</strong>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
