"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import type { BranchListItem } from "@/lib/hr/employees-server";
import { createEmployeeAction } from "./actions";
import { createEmployeeInitialState, type CreateEmployeeState } from "./action-types";

type Props = {
  houseId: string;
  houseSlug: string;
  branches: BranchListItem[];
  branchLoadError?: string;
};

type LookupIdentifier = { type: string; value_masked: string; is_primary?: boolean };
type LookupMatch = { entityId: string; displayName: string | null; identifiers: LookupIdentifier[]; confidence: string };

function FieldError({ message }: { message?: string[] }) {
  if (!message || message.length === 0) return null;
  return <p className="text-sm text-destructive">{message[0]}</p>;
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <Button type="submit" disabled={isDisabled}>
      {pending ? "Creating…" : "Create employee"}
    </Button>
  );
}

export function CreateEmployeeForm({ houseId, houseSlug, branches, branchLoadError }: Props) {
  const [state, formAction] = useFormState<CreateEmployeeState, FormData>(createEmployeeAction, createEmployeeInitialState);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [identityDecision, setIdentityDecision] = useState<"existing" | "new" | null>(null);
  const [lookupPerformed, setLookupPerformed] = useState(false);
  const [lookupMatches, setLookupMatches] = useState<LookupMatch[]>([]);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupPending, startLookup] = useTransition();
  const [rate, setRate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("active");
  const router = useRouter();
  const toast = useToast();

  const branchOptions = useMemo(
    () => [{ id: "", name: "Unassigned" }, ...branches],
    [branches],
  );

  const parsedRate = Number.parseFloat(rate);
  const emailPattern = /^\S+@\S+\.\S+$/;
  const phoneDigits = phone.replace(/\D/g, "");
  const emailOk = !email.trim() || emailPattern.test(email.trim());
  const phoneOk = !phone.trim() || phoneDigits.length >= 7;
  const hasIdentityContact = Boolean(email.trim()) || phoneDigits.length >= 7;
  const baseValid = fullName.trim().length >= 2 && Number.isFinite(parsedRate) && parsedRate > 0 && emailOk && phoneOk;
  const identityReady =
    lookupPerformed &&
    ((identityDecision === "existing" && Boolean(selectedEntityId)) ||
      (identityDecision === "new" && hasIdentityContact && emailOk && phoneOk));
  const canSubmit = baseValid && identityReady;
  const selectedMatch = selectedEntityId ? lookupMatches.find((m) => m.entityId === selectedEntityId) ?? null : null;

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Employee created successfully.");
      router.replace(`/company/${houseSlug}/hr/employees`);
    }
    if (state.status === "idle") {
      setLookupError(null);
      setLookupMessage(null);
    }
  }, [houseSlug, router, state.status, toast]);

  useEffect(() => {
    if (state.conflict?.employeeId) {
      setLookupMessage(
        state.conflict.code && state.conflict.fullName
          ? `Existing active employee: ${state.conflict.code} · ${state.conflict.fullName}`
          : "This entity is already an active employee in this house.",
      );
      setIdentityDecision("existing");
      setLookupPerformed(true);
    }
    if (state.selectedEntityId) {
      setSelectedEntityId(state.selectedEntityId);
      setIdentityDecision("existing");
      setLookupPerformed(true);
    }
  }, [state.conflict, state.selectedEntityId]);

  const runLookup = () => {
    setLookupError(null);
    setLookupMessage(null);
    setIdentityDecision(null);
    setSelectedEntityId(null);
    setLookupPerformed(false);
    startLookup(async () => {
      if (!houseId?.trim()) {
        setLookupError("Missing house context. Reload and try again.");
        setLookupMatches([]);
        return;
      }

      if (!email.trim() && !phone.trim()) {
        setLookupError("Enter an email or phone to look up an identity.");
        setLookupMatches([]);
        return;
      }

      try {
        const response = await fetch("/api/hr/employees/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, phone, houseId }),
        });
        const payload = await response.json();

        if (!response.ok) {
          setLookupError(payload?.message ?? "Unable to look up identities right now.");
          setLookupMatches([]);
          return;
        }

        const matches =
          (payload?.matches as Array<{
            entityId?: string;
            entity_id?: string;
            displayName?: string | null;
            display_name?: string | null;
            matched_identifiers?: LookupIdentifier[];
            identifiers?: LookupIdentifier[];
            match_confidence?: string;
            confidence?: string;
          }>) ?? [];

        const normalized = matches
          .map((match) => ({
            entityId: match.entityId ?? match.entity_id ?? "",
            displayName: match.displayName ?? match.display_name ?? null,
            identifiers: (match.matched_identifiers ?? match.identifiers ?? []).filter(Boolean),
            confidence: match.match_confidence ?? match.confidence ?? "multiple",
          }))
          .filter((m) => m.entityId);

        setLookupMatches(normalized);
        setLookupPerformed(true);
        if (normalized.length === 0) {
          setLookupMessage("No match found — a new person identity will be created if you proceed.");
        } else if (normalized.length === 1) {
          setLookupMessage("Found 1 matching person. Select to reuse the identity.");
        } else {
          setLookupMessage("Multiple matches found — choose the correct person to avoid duplicates.");
        }

        if (normalized.every((m) => m.entityId !== selectedEntityId)) {
          setSelectedEntityId(null);
          setIdentityDecision(null);
        }
      } catch (error) {
        console.error("Identity lookup failed", error);
        setLookupError("Unable to look up identities right now.");
        setLookupMatches([]);
        setLookupPerformed(false);
      }
    });
  };

  const generalError = state.status === "error" ? state.message : null;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Add employee</h1>
        <p className="text-sm text-muted-foreground">
          Create a new employee within this house. Branches are scoped to this workspace and email/phone are used to link identity.
        </p>
      </div>

      {generalError ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {generalError}
        </div>
      ) : null}

      {state.conflict?.employeeId ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This entity is already an active employee in this house:{" "}
          <Link className="underline" href={`/company/${houseSlug}/hr/employees/${state.conflict.employeeId}`}>
            {state.conflict.code ? `${state.conflict.code} · ` : null}
            {state.conflict.fullName ?? "View existing record"}
          </Link>
          . Rehire by marking the existing employee inactive first.
        </div>
      ) : null}

      <form className="space-y-4" action={formAction}>
        <input type="hidden" name="houseId" value={houseId} />
        <input type="hidden" name="houseSlug" value={houseSlug} />
        <input type="hidden" name="entity_id" value={selectedEntityId ?? ""} />

        <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Step 1: Look up identity</p>
              <p className="text-xs text-muted-foreground">
                Search for an existing person in this house using phone or email. Identities stay masked.
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={runLookup} disabled={lookupPending}>
              {lookupPending ? "Looking up…" : "Lookup identity"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-sm text-muted-foreground">
              Email (optional, for identity linking)
              <Input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                onBlur={() => {
                  setLookupMessage(null);
                  setLookupError(null);
                }}
              />
              {!emailOk ? <p className="text-sm text-destructive">Enter a valid email.</p> : null}
              <FieldError message={state.fieldErrors?.email} />
            </label>

            <label className="block space-y-1 text-sm text-muted-foreground">
              Phone (optional, for identity linking)
              <Input
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+63 917 123 4567"
                inputMode="tel"
                onBlur={() => {
                  setLookupMessage(null);
                  setLookupError(null);
                }}
              />
              {!phoneOk ? <p className="text-sm text-destructive">Enter a valid phone number.</p> : null}
              <FieldError message={state.fieldErrors?.phone} />
            </label>
          </div>

          {lookupError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {lookupError}
            </div>
          ) : null}
          {lookupMessage ? (
            <div className="rounded-md border border-border/50 bg-background px-3 py-2 text-xs text-foreground">
              {lookupMessage}
            </div>
          ) : null}
          {lookupMatches.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {lookupMatches.map((match) => (
                <button
                  key={match.entityId}
                  type="button"
                  onClick={() => {
                    setSelectedEntityId(match.entityId);
                    setIdentityDecision("existing");
                    if (!fullName.trim() && match.displayName) {
                      setFullName(match.displayName);
                    }
                  }}
                  className={`rounded-md border px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary ${
                    selectedEntityId === match.entityId ? "border-primary bg-primary/5" : "border-border bg-background"
                  }`}
                >
                  <div className="font-medium text-foreground">{match.displayName || "Unnamed person"}</div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {match.identifiers.map((id) => (
                      <div key={`${match.entityId}-${id.type}-${id.value_masked}`}>
                        {id.type}: {id.value_masked}
                        {id.is_primary ? " • primary" : ""}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    {match.confidence === "single" ? "Single match" : "Possible match"}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={identityDecision === "new" ? "solid" : "outline"}
              disabled={!lookupPerformed || lookupPending}
              onClick={() => {
                setIdentityDecision("new");
                setSelectedEntityId(null);
              }}
            >
              Use a new identity
            </Button>
            {lookupPerformed ? (
              <p className="text-xs text-muted-foreground">
                {identityDecision === "existing"
                  ? "Selected an existing person. Proceed to confirm the employee details."
                  : "No match? Continue with a new identity using the provided contact details."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Run an identity lookup before choosing how to proceed.</p>
            )}
          </div>

          {selectedEntityId && identityDecision === "existing" ? (
            <p className="text-xs text-foreground">
              Using existing identity:{" "}
              <span className="font-medium">
                {selectedMatch?.displayName || "Selected person"} ({selectedEntityId})
              </span>
              . Clear or change the lookup to select a different person.
            </p>
          ) : null}
          {identityDecision === "new" ? (
            <p className="text-xs text-foreground">
              A new platform identity will be created for this employee using the email/phone above after you finish the form.
            </p>
          ) : null}
        </div>

        <fieldset
          className="space-y-4 rounded-md border border-border/60 bg-background p-3"
          disabled={!identityReady}
          aria-disabled={!identityReady}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Step 2: Employee details</p>
              <p className="text-xs text-muted-foreground">Create the employee record under this house.</p>
            </div>
            {!identityReady ? (
              <span className="text-xs text-muted-foreground">Complete identity selection to unlock details.</span>
            ) : null}
          </div>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Full name
            <Input
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Ada Lovelace"
              required
            />
            <FieldError message={state.fieldErrors?.full_name} />
          </label>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Branch
            <select
              name="branch_id"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm"
              disabled={Boolean(branchLoadError)}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id || "unassigned"} value={branch.id}>
                  {branch.name || "Unassigned"}
                </option>
              ))}
            </select>
            {branchLoadError ? (
              <p className="text-sm text-destructive">Unable to load branches. Try again later.</p>
            ) : null}
            <FieldError message={state.fieldErrors?.branch_id} />
          </label>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Position/Role
            <Input name="position_title" placeholder="e.g., Cashier" />
            <FieldError message={state.fieldErrors?.position_title} />
          </label>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Rate per day
            <Input
              name="rate_per_day"
              type="number"
              step="0.01"
              min="0"
              value={rate}
              inputMode="decimal"
              onChange={(e) => setRate(e.target.value)}
              required
            />
            <FieldError message={state.fieldErrors?.rate_per_day} />
          </label>

          <label className="block space-y-1 text-sm text-muted-foreground">
            Status
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <FieldError message={state.fieldErrors?.status} />
          </label>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <SubmitButton disabled={!canSubmit} />
          <Button asChild variant="ghost">
            <Link href={`/company/${houseSlug}/hr/employees`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}
