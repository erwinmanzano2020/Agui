# HR-2.3 Freeze Declaration (HR-2.0 → HR-2.3.3)

## Freeze Scope
The HR-2.3.x track is now contract-stable. The following increments are frozen:
- **HR-2.0**: `dtr_segments` canonical schema (raw truth)
- **HR-2.1**: Daily DTR entry (manual segments)
- **HR-2.2**: Schedules (templates/windows/branch assignments)
- **HR-2.3.1**: OT policy editor (house-scoped)
- **HR-2.3.2**: Overtime engine (read-only derived OT)
- **HR-2.3.3**: Payroll Preview (read-only aggregation)

## Frozen Contracts (Copy/Paste Ready)
### DTR raw truth
- `dtr_segments` is the source of truth for attendance.
- Multiple segments per employee per day are allowed.
- Segment fields (`time_in`, `time_out`, `status`, `source`, etc.) retain their HR-2.0 meanings.
- Open segments are allowed (`time_out` is null).
- No auto-closing rules exist in HR-2.x.

### Schedules
- Schedule templates/windows exist and are house-scoped.
- Branch assignments are effective-dated (`effective_from`) and branch-scoped.
- Schedule timezone is **Asia/Manila**.

### OT policy
- Policy is house-scoped (min threshold + rounding mode/minutes).
- Policy affects derived OT only; it never mutates DTR data.

### Overtime engine
- Read-only computation layer.
- OT begins after schedule end (Asia/Manila).
- Open segments are excluded from OT totals and flagged.

### Payroll preview
- Read-only aggregation.
- Aggregates work minutes and derived OT minutes.
- No money computations, payslip generation, or payroll run creation.
- HR-3 payroll runs only **snapshot** this output; the preview logic stays frozen.

## Guardrails (“Don’t Break This”)
- HR-3 work must **not** mutate `dtr_segments` during preview/rollup.
- Do **not** add schedule validation into DTR entry.
- Do **not** mix timezone logic: always use Manila-deterministic helpers.
- Keep DTR capture separate from interpretation.

## Debugging Notes (Short)
- Migrations must include: `notify pgrst, 'reload schema';`
- If an RPC signature changes: update app code and docs together.

## Related Docs
- [HR-2.0 Foundation Freeze](./hr-2-foundation-freeze.md)
- [HR-2.1 Daily DTR Entry](./hr-2-1-daily-dtr-review.md)
- [HR-2.2 Schedules Freeze](./hr-2-2-schedules-freeze.md)
- [HR-2.3 Overtime Engine](./hr-2-3-overtime-engine.md)
- [HR-2.3.3 Payroll Preview](./hr-2-3-3-payroll-preview.md)
