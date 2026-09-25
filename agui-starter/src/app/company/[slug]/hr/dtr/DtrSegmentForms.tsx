"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import type {
  AttendanceRemediationCandidate,
  CanonicalAttendanceRow,
} from "@/lib/hr/attendance-p1-server";
import type { BranchListItem } from "@/lib/hr/employees-server";
import { formatManilaTimeForUi } from "@/lib/hr/timezone";
import {
  adjudicateDtrRemediationAction,
  createDtrSegmentAction,
  openDtrRemediationAction,
  proposeDtrCorrectionAction,
} from "./actions";
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

function useOperationId(resetSignal: unknown) {
  const [operationId, setOperationId] = useState("");

  useEffect(() => {
    setOperationId(crypto.randomUUID());
  }, [resetSignal]);

  return operationId;
}

function useOperationPair(resetSignal: unknown) {
  const first = useOperationId(resetSignal);
  const second = useOperationId(resetSignal);
  return [first, second] as const;
}

type BaseProps = {
  houseId: string;
  houseSlug: string;
  workDate: string;
};

export function CorrectionDtrFactForm({
  houseId,
  houseSlug,
  fact,
  branches,
  canChangeLocation,
}: {
  houseId: string;
  houseSlug: string;
  fact: CanonicalAttendanceRow;
  branches: BranchListItem[];
  canChangeLocation: boolean;
}) {
  const [state, formAction] = useFormState(
    proposeDtrCorrectionAction,
    dtrMutationInitialState,
  );
  const [proposalOperationId, finalizeOperationId] = useOperationPair(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="houseId" value={houseId} />
      <input type="hidden" name="houseSlug" value={houseSlug} />
      <input type="hidden" name="factId" value={fact.fact_id} />
      <input
        type="hidden"
        name="proposalOperationId"
        value={proposalOperationId}
        readOnly
      />
      <input
        type="hidden"
        name="finalizeOperationId"
        value={finalizeOperationId}
        readOnly
      />

      <label className="flex flex-col text-xs text-muted-foreground">
        Work date
        <input
          type="date"
          name="workDate"
          defaultValue={fact.work_date}
          required
          className="w-40 rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.workDate} />
      </label>

      <label className="flex flex-col text-xs text-muted-foreground">
        Time in
        <input
          type="time"
          name="timeIn"
          defaultValue={formatTimeInput(fact.time_in)}
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
          defaultValue={formatTimeInput(fact.time_out)}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.timeOut} />
      </label>

      {canChangeLocation ? (
        <label className="flex flex-col text-xs text-muted-foreground">
          Actual branch correction
          <select
            name="targetBranchId"
            defaultValue=""
            className="min-w-[190px] rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">Keep current attribution</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {branch.id === fact.active_branch_id ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="flex min-w-[220px] flex-1 flex-col text-xs text-muted-foreground">
        Reason
        <input
          type="text"
          name="reason"
          required
          minLength={3}
          placeholder="Why is this correction needed?"
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
        />
        <FieldError message={state.fieldErrors.reason} />
      </label>

      <SubmitButton
        label="Propose correction"
        pendingLabel="Submitting…"
        className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60"
        disabled={!proposalOperationId || !finalizeOperationId}
      />

      <MutationMessage
        status={state.status}
        message={state.message}
        formError={state.fieldErrors.form}
      />
      {state.caseId ? (
        <span className="text-[11px] text-muted-foreground">
          Case: {state.caseId}
        </span>
      ) : null}
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
  const [state, formAction] = useFormState(
    createDtrSegmentAction,
    dtrMutationInitialState,
  );
  const operationId = useOperationId(state);

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
      <MutationMessage
        status={state.status}
        message={state.message}
        formError={state.fieldErrors.form}
      />
    </form>
  );
}

function CandidateLabel({ candidate }: { candidate: AttendanceRemediationCandidate }) {
  if (candidate.kind === "FACT") {
    return (
      <>
        Existing fact · {candidate.workDate ?? "unknown date"} ·{" "}
        {formatManilaTimeForUi(candidate.timeIn ?? null)}–
        {formatManilaTimeForUi(candidate.timeOut ?? null)}
      </>
    );
  }
  if (candidate.kind === "EVIDENCE") {
    return (
      <>
        Evidence · {candidate.integrityState ?? "unknown"} ·{" "}
        {candidate.occurredAt ? formatManilaTimeForUi(candidate.occurredAt) : "time unavailable"}
      </>
    );
  }
  return (
    <>
      Observation ·{" "}
      {candidate.occurredAt ? formatManilaTimeForUi(candidate.occurredAt) : "time unavailable"}
    </>
  );
}

function RemediationAdjudicationForm({
  houseId,
  houseSlug,
  state,
}: {
  houseId: string;
  houseSlug: string;
  state: {
    caseId?: string;
    coverageComplete?: boolean;
    candidates?: AttendanceRemediationCandidate[];
  };
}) {
  const [result, formAction] = useFormState(
    adjudicateDtrRemediationAction,
    dtrMutationInitialState,
  );
  const [decision, setDecision] = useState<"EXISTING_RELATED" | "DISTINCT_NEW">(
    (state.candidates?.length ?? 0) > 0 ? "EXISTING_RELATED" : "DISTINCT_NEW",
  );
  const [operationId, finalizeOperationId] = useOperationPair(result);
  const reviewState =
    result.resultStatus === "STALE" && result.caseId === state.caseId
      ? result
      : state;
  const candidates = reviewState.candidates ?? [];
  const coverageComplete = reviewState.coverageComplete ?? false;

  if (!state.caseId) return null;

  return (
    <div className="mt-4 rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-xs font-medium text-foreground">
        Candidate adjudication
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Case {state.caseId}. The resolver found {candidates.length} candidate
        {candidates.length === 1 ? "" : "s"}.
      </p>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="houseId" value={houseId} />
        <input type="hidden" name="houseSlug" value={houseSlug} />
        <input type="hidden" name="caseId" value={state.caseId} />
        <input type="hidden" name="operationId" value={operationId} readOnly />
        <input
          type="hidden"
          name="finalizeOperationId"
          value={finalizeOperationId}
          readOnly
        />

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="EXISTING_RELATED"
              checked={decision === "EXISTING_RELATED"}
              onChange={() => setDecision("EXISTING_RELATED")}
              disabled={candidates.length === 0}
            />
            Existing / related
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decision"
              value="DISTINCT_NEW"
              checked={decision === "DISTINCT_NEW"}
              onChange={() => setDecision("DISTINCT_NEW")}
              disabled={!coverageComplete}
            />
            Genuinely distinct new attendance
          </label>
        </div>

        {decision === "EXISTING_RELATED" ? (
          <label className="flex flex-col text-xs text-muted-foreground">
            Related candidate
            <select
              name="selectedCandidateIdentity"
              required
              defaultValue=""
              className="rounded-md border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="" disabled>
                Select candidate
              </option>
              {candidates.map((candidate) => (
                <option key={candidate.identity} value={candidate.identity}>
                  {candidate.kind} · {candidate.identity}
                </option>
              ))}
            </select>
            <FieldError message={result.fieldErrors.selectedCandidateIdentity} />
          </label>
        ) : null}

        <ul className="space-y-1 text-[11px] text-muted-foreground">
          {candidates.map((candidate) => (
            <li key={candidate.identity} className="rounded border border-border/60 p-2">
              <CandidateLabel candidate={candidate} />
            </li>
          ))}
        </ul>

        {!coverageComplete ? (
          <p className="text-xs text-destructive">
            Candidate coverage is incomplete. Distinct-new creation is disabled.
          </p>
        ) : null}

        <SubmitButton
          label="Record adjudication"
          pendingLabel="Recording…"
          className="rounded-md border border-border px-3 py-2 text-xs font-medium"
          disabled={
            !operationId ||
            !finalizeOperationId ||
            (decision === "DISTINCT_NEW" && !coverageComplete)
          }
        />
        <MutationMessage
          status={result.status}
          message={result.message}
          formError={result.fieldErrors.form}
        />
      </form>
    </div>
  );
}

export function RemediationDtrForm({
  houseId,
  houseSlug,
  workDate,
  employeeId,
  branches,
}: BaseProps & {
  employeeId: string;
  branches: BranchListItem[];
}) {
  const [state, formAction] = useFormState(
    openDtrRemediationAction,
    dtrMutationInitialState,
  );
  const operationId = useOperationId(state);

  return (
    <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
      <summary className="cursor-pointer text-xs font-medium text-foreground">
        Owner/manager historical missing-attendance review
      </summary>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-3">
        <input type="hidden" name="houseId" value={houseId} />
        <input type="hidden" name="houseSlug" value={houseSlug} />
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="operationId" value={operationId} readOnly />

        <label className="flex flex-col text-xs text-muted-foreground">
          Actual attendance branch
          <select
            name="assertedBranchId"
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
          <FieldError message={state.fieldErrors.assertedBranchId} />
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
          Time out
          <input
            type="time"
            name="timeOut"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <FieldError message={state.fieldErrors.timeOut} />
        </label>

        <label className="flex min-w-[220px] flex-1 flex-col text-xs text-muted-foreground">
          Reason
          <input
            type="text"
            name="reason"
            required
            minLength={3}
            placeholder="Why is historical attendance believed to be missing?"
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
          <FieldError message={state.fieldErrors.reason} />
        </label>

        <SubmitButton
          label="Review candidates"
          pendingLabel="Resolving…"
          className="rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-medium"
          disabled={!operationId}
        />
        <MutationMessage
          status={state.status}
          message={state.message}
          formError={state.fieldErrors.form}
        />
      </form>

      {state.caseId ? (
        <RemediationAdjudicationForm
          houseId={houseId}
          houseSlug={houseSlug}
          state={state}
        />
      ) : null}
    </details>
  );
}
