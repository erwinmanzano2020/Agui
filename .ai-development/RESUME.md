# Resume Agui

Project Control Center:
https://docs.google.com/spreadsheets/d/1a0sXhx96Yxsn2b0pyo23OoS7nuloR1nmLrz6I7sEMhM/edit

Before acting:
1. Read Current, blocking Questions, relevant Decisions, recent Dev Log, open UAT & Bugs, latest Releases.
2. Read root AGENTS.md and the closest local AGENTS.md.
3. Read the governing HR roadmap/master-plan material for the active milestone.
4. Inspect current `develop` head and any active PR/CI/deployment state.
5. Report current milestone, stage, next authorized action, blockers, risk lane, and selected skills.

Current checkpoint (2026-10-11):
- HR remains the sole active phase. Risk lane: CONTROLLED.
- Bounded task: GAP-024 Gate D Final Acceptance, PR #522,
  `codex/runtime-gap-024-gate-d-consumer-migration` against `develop`.
- Initially verified hosted head: `2500859701c0d5d38b685b8bd5cbe10aaa78fff8`.
- Functional correction: `3066741234815fc7b80e1b7698e70d810121cdab`.
- Missing/invalid `has_finalized_correction` now rejects rather than becoming false.
- Local 628/628 relevant tests, lint, typecheck, and CI-fallback build passed.
- Decision: **BLOCKED**. No authenticated UAT run; UAT HTTPS is proxy-denied (403),
  credentials/actor sessions and current security-advisor evidence are unavailable.
- Durable acceptance evidence and staged sync payload:
  `docs/devlog/gap-024-gate-d-final-acceptance.md`.
- Next authorized action: securely restore isolated `agui-p1-uat` access, verify live
  reader contract, and complete the recorded matrix on the exact candidate head.
- Do not merge #522, modify/resume Production, pause/delete either Supabase project,
  start Gate E, or restart an open-ended review loop.

Historical seeded checkpoint (2026-10-03):
- HR is the sole active phase.
- Current `develop` head after owner-approved Gate C planning merge:
  `bd90af64eafe1ca5204c47da05dbc0e10a829679`.
- GAP-024 Remaining Gate B is fully released and Production-verified:
  PR #516 squash merge `1193dc29007ccf0c0eadc1a8ebd483dff233444d`,
  Production deployment `dpl_GSk4sj6wCbbxsSS3P2dftH9tHskd`, both staged
  Remaining-Gate-B migrations applied, canonical invariants green.
- Next authorized milestone resolved from governing docs: **GAP-024 Gate C — canonical
  Daily DTR facts-only cutover**.
- Gate C planning PR #519 is merged.
- Gate C Runtime branch:
  `codex/runtime-gap-024-gate-c-daily-dtr-cutover`.
- Current Runtime PR: **#520**.
- Gate C planning artifact:
  `docs/devlog/gap-024-gate-c-daily-dtr-cutover-plan.md`.
- Risk lane: CONTROLLED.
- Gate C planning is CONVERGED. Reviewed candidate
  `f2479fcc9ceaf439591df315f8f582e5e8db6f12` passed Preflight #1025 and Vercel
  exact-head verification with zero unresolved material planning findings.
- Owner approved converged Gate C planning on 2026-10-03.
- Gate C is PRODUCTION-VERIFIED / CLOSED.
- PR #520 squash-merged as `fef6dd7f5af29473f064275d886d23d36afa4a41`.
- Exact Production deployment `dpl_5g4kPshzA1uBFmayMuisBQCTLRbL` is READY and targets
  production on the exact merge SHA.
- Production aliases are attached and post-promotion warning/error/fatal logs are clean.
- GAP-024 Gate D planning is ACTIVE on branch
  `codex/plan-gap-024-gate-d-consumer-migration`.
- Planning artifact:
  `docs/devlog/gap-024-gate-d-consumer-migration-plan.md`.
- Initial findings: payroll preview, payroll-run open-attendance guard, overtime,
  payslip recomputation, legacy browser payroll pages/helpers, and bulk API load paths
  still consume `dtr_segments` and/or `dtr_entries`.
- Gate D must preserve frozen payroll semantics and migrate consumers through canonical
  readers selected from resolved authority; Gate E remains last.
- First adversarial Gate D planning Review & Fix is complete.
- Next action: exact-head checks + fresh final planning review, then owner planning approval before Runtime.
- Daily DTR read visibility and write/capture authority must remain separate; same-day
  Option A+ manual capture is a separate write affordance, not a fabricated no-record row.
- Gate D/E remain unauthorized.
- POS remains paused unless explicitly reactivated.

Existing Agui governance outranks this resume note.
