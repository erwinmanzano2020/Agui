"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { issuePatronPass } from "./actions";
import { INITIAL_PATRON_PASS_STATE, type IssuePatronPassState } from "./state";

const checkboxClasses = cn(
  "h-4 w-4 rounded border border-border bg-background text-[var(--agui-primary)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

function StatusBanner({ state }: { state: IssuePatronPassState }) {
  if (state.status === "success" && state.message) {
    return (
      <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        {state.message}
      </div>
    );
  }

  if (state.status === "error" && state.message) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.message}
      </div>
    );
  }

  if (state.status === "needs-override" && state.message) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
        {state.message}
      </div>
    );
  }

  return null;
}

type PatronPassFormProps = {
  slug: string;
  houseName: string;
  passLabel: string;
  allowIncognito: boolean;
};

export function PatronPassForm({ slug, houseName, passLabel, allowIncognito }: PatronPassFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(issuePatronPass, INITIAL_PATRON_PASS_STATE);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  const needsOverride = state.status === "needs-override";
  const higherCard = state.higherCard;

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="slug" value={slug} />
      {state.entityId && <input type="hidden" name="entity_id" value={state.entityId} />}
      {needsOverride && <input type="hidden" name="force_issue" value="true" />}

      <StatusBanner state={state} />

      <div className="space-y-2">
        <label htmlFor="contact" className="text-sm font-medium text-foreground">
          Patron contact
        </label>
        <Input
          id="contact"
          name="contact"
          type="text"
          placeholder="you@example.com or +63 900 000 0000"
          required={!state.entityId}
          disabled={needsOverride}
        />
        <p className="text-xs text-muted-foreground">
          We’ll search by email or phone and create a new patron profile automatically when needed.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="incognito-default"
          name="incognito_default"
          className={checkboxClasses}
          defaultChecked={allowIncognito}
          disabled={!allowIncognito}
        />
        <label htmlFor="incognito-default" className="text-sm text-foreground">
          Start this pass in incognito mode
        </label>
      </div>
      {!allowIncognito && (
        <p className="text-xs text-muted-foreground">
          Incognito is disabled for this scheme. Enable it from the guild dashboard to hide cross-scope details by default.
        </p>
      )}

      {needsOverride && higherCard && (
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>
            {higherCard.name} ({higherCard.scope}) — card number {higherCard.cardNo}
          </p>
          <div className="space-y-2">
            <label htmlFor="override-reason" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reason for issuing anyway
            </label>
            <Input
              id="override-reason"
              name="override_reason"
              placeholder="Prefers location-specific perks"
              required
            />
            <p className="text-xs text-muted-foreground">
              This note is saved so staff can audit why a lower-precedence pass was issued.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Issue a {passLabel.toLowerCase()} that works at {houseName}. You can override incognito mode per scan later.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Issuing…" : needsOverride ? "Issue anyway" : `Issue ${passLabel}`}
        </Button>
      </div>
    </form>
  );
}
