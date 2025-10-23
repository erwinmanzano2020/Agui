"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  applyToGuild,
  INITIAL_APPLY_TO_GUILD_STATE,
  type ApplyToGuildFormState,
} from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Joining…" : label}
    </Button>
  );
}

function StatusBanner({ state }: { state: ApplyToGuildFormState }) {
  if (state.status === "success") {
    return (
      <div
        role="status"
        className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400"
      >
        {state.message}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {state.message}
      </div>
    );
  }

  return null;
}

export function JoinGuildForm({
  slug,
  guildName,
  guildLabel,
}: {
  slug: string;
  guildName: string;
  guildLabel: string;
}) {
  const [state, formAction] = useFormState(applyToGuild, INITIAL_APPLY_TO_GUILD_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Share a contact to join instantly</h2>
        <p className="text-sm text-muted-foreground">
          Enter an email or phone number and we’ll register you as a member of {guildName} right away.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <StatusBanner state={state} />

        <form ref={formRef} action={formAction} className="space-y-6">
          <input type="hidden" name="slug" value={slug} />

          <div className="space-y-2">
            <label htmlFor="join-email" className="text-sm font-medium text-foreground">
              Email address
            </label>
            <Input
              id="join-email"
              name="email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              We’ll match this email to your existing account or create a new member record.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="join-phone" className="text-sm font-medium text-foreground">
              Phone number
            </label>
            <Input
              id="join-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              placeholder="+63 900 000 0000"
              autoComplete="tel"
            />
            <p className="text-xs text-muted-foreground">
              Prefer SMS? Share a phone number instead. Only one contact method is required.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              You’ll be added as a {guildLabel.toLowerCase()} member immediately — no approval queue.
            </p>
            <SubmitButton label={`Join ${guildName}`} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
