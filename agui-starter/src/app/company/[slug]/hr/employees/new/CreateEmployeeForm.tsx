"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const isValid = fullName.trim().length >= 2 && Number.isFinite(parsedRate) && parsedRate > 0 && emailOk && phoneOk;

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Employee created successfully.");
      router.replace(`/company/${houseSlug}/hr/employees`);
    }
  }, [houseSlug, router, state.status, toast]);

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

      <form className="space-y-4" action={formAction}>
        <input type="hidden" name="houseId" value={houseId} />
        <input type="hidden" name="houseSlug" value={houseSlug} />

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
          Email (optional, for identity linking)
          <Input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
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
          />
          {!phoneOk ? <p className="text-sm text-destructive">Enter a valid phone number.</p> : null}
          <FieldError message={state.fieldErrors?.phone} />
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

        <div className="flex flex-wrap gap-2">
          <SubmitButton disabled={!isValid} />
          <Button asChild variant="ghost">
            <Link href={`/company/${houseSlug}/hr/employees`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}
