"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import type { DtrSegmentRow } from "@/lib/db.types";
import type { BranchListItem } from "@/lib/hr/employees-server";
import { formatManilaTimeForUi } from "@/lib/hr/timezone";
import { createDtrSegmentAction, updateDtrSegmentAction } from "./actions";
import { dtrMutationInitialState } from "./action-types";

export function FieldError({ message }: { message?: string[] }) {
  if (!message || message.length === 0) return null;
  return <p className="text-xs text-destructive">{message[0]}</p>;
}

export function MutationMessage({
  status,
  message,
  formError,
}: {
  status: "idle" | "success" | "error";
  message: string;
  formError?: string[];
}) {
  const visibleFormError = status === "error" ? formError?.[0] : undefined;
  if (status === "idle" || (!message && !visibleFormError)) return null;
  return (
    <p className={`w-full text-xs ${status === "error" ? "text-destructive" : "text-emerald-700"}`}>
      {message}
      {visibleFormError ? ` ${visibleFormError}` : ""}
    </p>
  );
}

export function SubmitButtonView({
  label,
  pendingLabel,
  className,
  pending,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  className,
  disabled = false,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <SubmitButtonView
      label={label}
      pendingLabel={pendingLabel}
      className={className}
      pending={pending}
      disabled={disabled}
    />
  );
}

function formatTimeInput(value: string | null) {
  return formatManilaTimeForUi(value);
}

function useOperationId(resetOnSuccess: boolean) {
  const [operationId, setOperationId] = useState("");

  useEffect(() => {
    setOperationId(crypto.randomUUID());
  }, []);

  useEffect(() => {
    if (resetOnSuccess) {
      setOperationId(crypto.randomUUID());
    }
  }, [resetOnSuccess]);

  return operationId;
}

type BaseProps = {
  houseId: string;
  houseSlug: string;
  workDate: string;
};

export function UpdateDtrSegmentForm({
  houseId,
  houseSlug,
  workDate,
  segment,
  expectedValueRevision,
  canEdit,
}: BaseProps & {
  segment: DtrSegmentRow;
  expectedValueRevision: number | null;
  canEdit: boolean;
}) {
  const [state, formAction] = useFormState(updateDtrSegmentAction, dtrMutationInitialState);
  const operationId = useOperationId(state.status === "success");

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />
      <input type="hidden" name="segmentId" value={segment.id} />
      <input type="hidden" name="workDate" value={workDate} />
      <input
        type="hidden"
        name="expectedValueRevision"
        value={expectedValueRevision ?? ""}
      />
      <input type="hidden" name="operationId" value={operationId} readOnly />
      <label className="flex flex-col text-xs text-muted-foreground">
        Time in
        <input
          type="time"
          name="timeIn"
          defaultValue={formatTimeInput(segment.time_in)}
          required
          disabled={!canEdit}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
        />
        <FieldError message={state.fieldErrors.timeIn} />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Time out
        <input
          type="time"
          name="timeOut"
          defaultValue={formatTimeInput(segment.time_out)}
          disabled={!canEdit}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-60"
        />
        <FieldError message={state.fieldErrors.timeOut} />
      </label>
      <span className="text-xs text-muted-foreground">
        Status: {segment.status}
      </span>
      {canEdit ? (
        <SubmitButton
          label="Save"
          pendingLabel="Saving…"
          className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground"
          disabled={!operationId}
        />
      ) : (
        <span className="text-xs text-muted-foreground">Read only</span>
      )}
      <MutationMessage status={state.status} message={state.message} formError={state.fieldErrors.form} />
    </form>
  );
}

export function CreateDtrSegmentForm({
  houseId,
  houseSlug,
  workDate,
  employeeId,
  branches,
}: BaseProps & { employeeId: string; branches: BranchListItem[] }) {
  const [state, formAction] = useFormState(createDtrSegmentAction, dtrMutationInitialState);
  const operationId = useOperationId(state.status === "success");
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="workDate" value={workDate} />
      <input type="hidden" name="operationId" value={operationId} readOnly />
      <label className="flex flex-col text-xs text-muted-foreground">
        Attendance occurred at
        <select
          name="actualBranchId"
          required
          defaultValue=""
          className="min-w-[180px] rounded-md border border-border bg-background px-2 py-1 text-sm"
        >
          <option value="" disabled>
            Select branch
          </option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
        <FieldError message={state.fieldErrors.actualBranchId} />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Time in
        <input
          type="time"
          name="timeIn"
          required
          defaultValue="09:00"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.timeIn} />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Time out (optional)
        <input
          type="time"
          name="timeOut"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.timeOut} />
      </label>
      <SubmitButton
        label="Add segment"
        pendingLabel="Adding…"
        className="rounded-md border border-border bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-60"
        disabled={!operationId}
      />
      <MutationMessage status={state.status} message={state.message} formError={state.fieldErrors.form} />
    </form>
  );
}
