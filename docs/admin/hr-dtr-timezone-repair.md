# HR Admin — DTR Timezone Repair (Canonical Maintenance)

## Status

Gate-B containment retires direct `UPDATE dtr_segments` repair SQL. Attendance repair
must preserve canonical fact revisions, operation identity, employee generation, and
authorization projection.

The approved maintenance entrypoint is:

`public.hr_apply_attendance_time_repair(...)`

It is **not granted to `anon`, `authenticated`, or `service_role`**. Use it only
from the approved administrator / database-owner break-glass SQL boundary.

## GAP-024 Gate D read classification

The candidate/generator SQL in this break-glass runbook intentionally reads
`public.dtr_segments` because the approved repair command is segment-targeted and
requires the compatibility segment identity plus the current canonical fact revision.

This is a **privileged administrator diagnostic**, not a normal attendance consumer:

- application/UI/API/payroll/payslip/kiosk/service readers must use the canonical
  attendance interfaces;
- the raw SELECT must remain inside the approved database-owner break-glass workflow;
- it does not authorize raw `INSERT`, `UPDATE`, or `DELETE`;
- all repair writes still go through
  `public.hr_apply_attendance_time_repair(...)`;
- this narrow diagnostic is recorded as a **Gate-E residual** for final raw/base-access
  retirement or bounding.

Gate D therefore leaves the repair procedure operational without treating this diagnostic
read as an application visibility authority.

## 1. Generate a House-scoped review set

Use the repository helper:

```bash
node --loader ts-node/esm scripts/fix-dtr-timezone.ts \
  --house=<house-uuid> \
  --cutoff=2026-02-01 \
  --direction=minus
```

The helper prints:

1. a read-only candidate query;
2. deterministic per-segment canonical repair calls;
3. dry-run / rollback guidance.

It never prints a raw attendance UPDATE.

## 2. Review before repair

For every selected row verify:

- House and employee are correct;
- the row is genuinely affected by the historical timezone defect;
- proposed `time_in` / `time_out` are correct;
- `canonical_fact_id` and current value revision match the generated expected token;
- the deterministic operation ID and reason describe this repair batch.

Do not repair rows merely because they match a broad time heuristic.

## 3. Dry run

Run only the reviewed generated calls inside an explicit transaction:

```sql
begin;

-- paste reviewed SELECT public.hr_apply_attendance_time_repair(...) calls here

-- verify canonical fact revisions, mutation-operation outcome, employee generation,
-- and authorization projection here.
-- If compatibility dtr_segments must also be inspected, do so only inside this same
-- administrator break-glass transaction; that raw diagnostic remains Gate-E residual.

rollback;
```

A dry run must not leave persistent attendance changes.

## 4. Apply

After the dry run matches the intended rows, repeat the same reviewed calls with the same
operation IDs:

```sql
begin;

-- same reviewed canonical repair calls

commit;
```

The stable operation ID makes an identical retry idempotent. Reusing an operation ID with
different material input fails closed.

## 5. Stale / conflict behavior

For an already bridged segment, pass the current canonical value revision captured during
review. If the fact advanced before the repair executes, the command fails stale instead
of overwriting newer state.

For an unbridged legacy segment, the canonical command performs the required bridge
bootstrap inside the serialized transaction; no raw fallback is allowed.

## 6. Verification

After commit:

- confirm segment timestamps;
- confirm a new canonical value revision exists when applicable;
- confirm `hr_attendance_mutation_operations` contains the operation result and
  `repairReason`;
- confirm employee generation advanced;
- confirm authorization projection rebuild completed;
- re-run payroll preview for the affected period.

## 7. Rollback

Do **not** restore rows with a direct SQL UPDATE.

If an applied repair itself was wrong, perform another explicitly reviewed canonical
repair using a new operation ID and the current expected value revision. Canonical
history is append-only; rollback means a compensating audited revision, not destructive
history rewrite.
