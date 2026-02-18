# Current State (Engineering Handoff)

## 1. Frozen Foundations
"Frozen" means schema + contracts + semantics are stable. Changes require a dedicated migration task and explicit approval.

- HR-1 (Employee + Identity linking) — **FROZEN**
- HR-2.0 foundations (DTR canonical model) — **FROZEN**

## 2. Canonical Contracts
- Canonical DTR model: `public.dtr_segments`
- Reference: `docs/hr/hr-2-foundation-freeze.md`
- `time_in` / `time_out` are the canonical time fields
- No alternative DTR tables or legacy aliases should be introduced

## 2.1 HR Current Increment (Active)
- HR-2.1: Daily DTR Entry (Manual, House-Scoped)
  - Reference: `docs/hr/hr-2-1-daily-dtr-review.md`
  - Raw capture only (non-negotiable boundaries):
    - Multiple segments per employee/day are allowed
    - No schedule logic yet
    - No overtime computation rules yet (e.g., 10-min minimum OT, OT after scheduled end)
    - No lunch-break rules yet
    - No auto-close / one open segment max rule unless it already exists
  - Timezone caution (short):
    - `time_in` / `time_out` are stored as timestamptz
    - Construction/parsing can be timezone-sensitive (e.g., `new Date(...)`)
    - Keep create/update consistent and avoid tests depending on local machine timezone
  - Next increment once merged: HR-2.3 overtime rules engine (house-configurable thresholds)
    - Reference: `docs/hr/hr-2-3-overtime-engine.md`
  - HR-2.3.1: Overtime policy editor UI (house-scoped)
    - Reference: `docs/hr/hr-2-3-overtime-engine.md`
  - HR-2.3.2: Read-only overtime computation (derived OT minutes, no writes)
    - Reference: `docs/hr/hr-2-3-overtime-engine.md`
  - HR-2.3.3: Payroll preview aggregation (read-only, house-scoped)
    - Reference: `docs/hr/hr-2-3-3-payroll-preview.md`
    - Boundary: no payroll ledger tables, no money computations, no DTR mutation
  - HR-2.3.x: Contract freeze (HR-2.0 → HR-2.3.3)
    - Reference: `docs/hr/hr-2-3-freeze.md`
    - Boundary: HR-3 starts here; HR-2.3.x is contract-stable
  - HR-3.0: Payroll runs (draft snapshots from preview, read-only)
    - Reference: `docs/hr/hr-3-0-payroll-runs.md`
    - Boundary: no money computation, no DTR mutation, no payroll finalization
  - HR-3.1: Finalize payroll runs (immutable snapshot lock)
    - Reference: `docs/hr/hr-3-1-finalize-payroll-runs.md`
    - Boundary: finalization locks the snapshot only; no pay computation yet
  - HR-3.2: Payslip preview (snapshot-based, read-only) + optional manual deductions
    - Reference: `docs/hr/hr-3-2-payslip-preview.md`
    - Boundary: computes regular/OT/undertime from snapshots only; no government deductions or payouts
  - HR-3.3: Payroll posting + paid status + adjustment runs + reference series + locks
    - Reference: `docs/hr/hr-3-3-posting-paid-adjustments.md`
    - Boundary: posted/paid runs are immutable; deductions lock after posting; corrections require adjustment runs
  - HR-3.3 frozen
    - Reference: `docs/hr/hr-3-3-freeze.md`
    - Boundary: no payouts, no gov deductions
  - HR-3.4.1: Payslip PDF (single employee, on-demand)
    - Reference: `docs/hr/hr-3-4-1-payslip-pdf.md`
    - Boundary: single-employee only, no bulk/merged export, no branding, no storage
  - HR-3.4.2: Payroll run PDF export (register + payslips)
    - Reference: `docs/hr/hr-3-4-2-run-pdf-export.md`
    - Boundary: merged register summary + payslips, no storage, snapshot-based only
  - HR-3.4.2 freeze
    - Reference: `docs/hr/hr-3-4-2-freeze.md`
    - Boundary: no storage/caching, no gov deductions, no payout integration
  - HR-3.5: Kiosk clock-in/out (QR, branch-scoped, offline queue)
    - Reference: `docs/hr/hr-3-5-kiosk.md`
    - Boundary: raw attendance capture only (`dtr_segments`, `source='system'`), no payroll/schedule/OT logic
  - HR-3.5 freeze
    - Reference: `docs/hr/hr-3-5-freeze.md`
    - Boundary: signed employee QR, kiosk token auth, 10s debounce, idempotent sync by `clientEventId`
  - HR-3.5.1: Kiosk devices admin (provision + disable + rotate + monitor)
    - Reference: `docs/hr/hr-3-5-1-kiosk-devices.md`
    - Boundary: admin lifecycle + monitoring only; no biometric/self-service/payroll logic
  - HR-3.5.1a: Kiosk setup wizard (token verify + hardening guidance)
    - Reference: `docs/hr/hr-3-5-1a-kiosk-setup-wizard.md`
    - Boundary: onboarding UX + ping verification; no payroll/schedule logic

## 3. Non-Negotiable Guardrails
- All HR/DTR data is house-scoped
- Cross-house writes are forbidden and enforced at DB level
- PostgREST schema must be reloaded after migrations
- `db.types.ts` must be regenerated after schema changes
- Destructive migrations are only allowed when explicitly stated

## 4. What Is NOT Frozen Yet
- DTR insert/update APIs
- Hours worked computation logic
- Overtime rules
- Approval workflows
- Audit/correction flows

## 4.1 Next Likely HR Increments
- HR-2.2: Schedule definition per house/branch (work windows)
  - Reference: `docs/hr/hr-2-2-schedules-freeze.md`
- HR-2.3: Overtime rules engine (house-configurable thresholds)
- HR-2.3.3: Payroll preview aggregation (read-only bridge to HR-3 payroll run tables)
- HR-3.0: Payroll runs (draft snapshot tables, read-only UI/API)
- HR-3.1: Finalize payroll runs (immutable snapshot lock)
- HR-2.4: DTR validation / closing workflow (optional approvals)
- HR-2.5: Payroll rollup integration from DTR segments

## 5. How to Use This Document
- Referenced at the start of Codex tasks
- Linked in future specs
- Used as a copy-paste context for new ChatGPT threads

> Context: HR-1 and HR-2.0 foundations are frozen. Canonical DTR model is dtr_segments as documented in docs/hr/hr-2-foundation-freeze.md.

- **HR 3.5.2 — Employee ID Cards (CR80) + QR Issuance**
    - Status: frozen
    - Reference: `docs/hr/hr-3-5-2-employee-id-cards.md`
    - Freeze: `docs/hr/hr-3-5-2-freeze.md`
    - Boundary: local-only QR image generation, fail-hard QR errors, deterministic ordering, bulk cap=200
