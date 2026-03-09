"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import type { BranchListItem, EmployeeProfile } from "@/lib/hr/employees-server";

import { EmployeePhotoField } from "../_components/EmployeePhotoField";
import { updateEmployeeAction } from "./actions";
import { updateEmployeeInitialState } from "./action-types";

type Props = {
  employee: EmployeeProfile;
  branches: BranchListItem[];
  branchLoadError?: string;
  houseId: string;
  houseSlug: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function FieldError({ message }: { message?: string[] }) {
  if (!message || message.length === 0) return null;
  return <p className="text-sm text-destructive">{message[0]}</p>;
}

export function EditEmployeeForm({ employee, branches, branchLoadError, houseId, houseSlug }: Props) {
  const [state, formAction] = useFormState(updateEmployeeAction, updateEmployeeInitialState);
  const router = useRouter();
  const toast = useToast();

  const branchOptions = useMemo(
    () => [{ id: "", name: "Unassigned" }, ...branches],
    [branches],
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success("Employee updated successfully.");
      router.replace(`/company/${houseSlug}/hr/employees/${employee.id}`);
    }
  }, [employee.id, houseSlug, router, state.status, toast]);

  const generalError = state.status === "error" ? state.message : null;

  return (
    <Card className="space-y-4 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Edit employee</h1>
        <p className="text-sm text-muted-foreground">
          Update core details for this employee. Codes and history stay unchanged.
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
        <input type="hidden" name="employeeId" value={employee.id} />

        <label className="block space-y-1 text-sm text-muted-foreground">
          Full name
          <Input name="full_name" defaultValue={employee.full_name} />
          <FieldError message={state.fieldErrors?.full_name} />
        </label>

        <label className="block space-y-1 text-sm text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={employee.status}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <FieldError message={state.fieldErrors?.status} />
        </label>

        <label className="block space-y-1 text-sm text-muted-foreground">
          Branch
          <select
            name="branch_id"
            defaultValue={employee.branch_id ?? ""}
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
          <Input name="position_title" defaultValue={employee.position_title ?? ""} placeholder="e.g., Cashier" />
          <FieldError message={state.fieldErrors?.position_title} />
        </label>

        <EmployeePhotoField employeeId={employee.id} initialPhotoUrl={employee.photo_url ?? null} />

        <label className="block space-y-1 text-sm text-muted-foreground">
          Rate per day
          <Input
            name="rate_per_day"
            type="number"
            step="0.01"
            min="0"
            defaultValue={employee.rate_per_day}
            inputMode="decimal"
          />
          <FieldError message={state.fieldErrors?.rate_per_day} />
        </label>

        <div className="flex flex-wrap gap-2">
          <SubmitButton />
          <Button asChild variant="ghost">
            <Link href={`/company/${houseSlug}/hr/employees/${employee.id}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </Card>
  );
}
