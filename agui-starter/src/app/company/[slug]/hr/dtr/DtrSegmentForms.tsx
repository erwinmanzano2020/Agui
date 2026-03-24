"use client";

import { useFormState, useFormStatus } from "react-dom";

import type { DtrSegmentRow } from "@/lib/db.types";
import { formatManilaTimeForUi } from "@/lib/hr/timezone";
import { createDtrSegmentAction, updateDtrSegmentAction } from "./actions";
import { dtrMutationInitialState } from "./action-types";

export function FieldError({ message }: { message?: string[] }) {
  if (!message || message.length === 0) return null;
  return <p className="text-xs text-destructive">{message[0]}</p>;
}

export function MutationMessage({ status, message }: { status: "idle" | "success" | "error"; message: string }) {
  if (status === "idle" || !message) return null;
  return (
    <p className={`w-full text-xs ${status === "error" ? "text-destructive" : "text-emerald-700"}`}>
      {message}
    </p>
  );
}

export function SubmitButtonView({
  label,
  pendingLabel,
  className,
  pending,
}: {
  label: string;
  pendingLabel: string;
  className: string;
  pending: boolean;
}) {
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return <SubmitButtonView label={label} pendingLabel={pendingLabel} className={className} pending={pending} />;
}

function formatTimeInput(value: string | null) {
  return formatManilaTimeForUi(value);
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
}: BaseProps & { segment: DtrSegmentRow }) {
  const [state, formAction] = useFormState(updateDtrSegmentAction, dtrMutationInitialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />
      <input type="hidden" name="segmentId" value={segment.id} />
      <input type="hidden" name="workDate" value={workDate} />
      <label className="flex flex-col text-xs text-muted-foreground">
        Time in
        <input
          type="time"
          name="timeIn"
          defaultValue={formatTimeInput(segment.time_in)}
          required
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.timeIn} />
      </label>
      <label className="flex flex-col text-xs text-muted-foreground">
        Time out
        <input
          type="time"
          name="timeOut"
          defaultValue={formatTimeInput(segment.time_out)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.timeOut} />
      </label>
      <span className="text-xs text-muted-foreground">
        Status: {segment.status}
      </span>
      <SubmitButton
        label="Save"
        pendingLabel="Saving…"
        className="rounded-md border border-border px-3 py-1 text-xs font-medium text-foreground"
      />
      <MutationMessage status={state.status} message={state.message} />
    </form>
  );
}

export function CreateDtrSegmentForm({ houseId, houseSlug, workDate, employeeId }: BaseProps & { employeeId: string }) {
  const [state, formAction] = useFormState(createDtrSegmentAction, dtrMutationInitialState);
  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="workDate" value={workDate} />
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
      />
      <MutationMessage status={state.status} message={state.message} />
    </form>
  );
}
