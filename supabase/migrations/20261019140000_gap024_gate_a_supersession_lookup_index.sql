-- GAP-024 Gate A supersession lookup performance correction.
--
-- Evidence sealing and fact activation repeatedly test whether a selected evidence
-- revision already has a committed direct successor in the same House/employee/lineage.
-- The original Gate-A migration created no targeted index for supersedes_evidence_id,
-- which would force repeated scans as canonical evidence grows.
--
-- Keep semantics unchanged and add only the lookup path used by those guards.

create index if not exists hr_attendance_evidence_supersession_lookup_idx
  on public.hr_attendance_evidence (
    house_id,
    supersedes_evidence_id,
    employee_id,
    lineage_root_evidence_id
  )
  where supersedes_evidence_id is not null;
