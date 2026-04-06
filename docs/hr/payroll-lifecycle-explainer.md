# HR Payroll Lifecycle (Canonical Behavior Guide)

## 1. Purpose

This document defines the **actual runtime behavior** of payroll runs in Agui.

It exists to prevent:
- wording drift between UI and docs  
- incorrect assumptions about “when pay is computed”  
- confusion around locking (finalize vs post)

This is a **behavior explainer**, not a feature spec.

---

## 2. Core Model

Payroll in Agui is built on a **snapshot → compute → lock lifecycle**.

Key principle:

> Payroll runs store **snapshots**, not computed money.  
> Payslips are **computed views** derived from those snapshots.

---

## 3. Lifecycle Stages

### 3.1 Draft

**What happens**
- Payroll run is created
- Snapshot rows are generated from payroll preview

**Editable**
- Snapshot rows (indirectly via regeneration)
- Manual deductions

**Available**
- Payslip preview (computed from snapshot)

---

### 3.2 Finalized

**What finalize does**
- Locks **snapshot rows only**

**What finalize does NOT do**
- Does NOT compute pay
- Does NOT lock deductions
- Does NOT generate final outputs

**State after finalize**
- Snapshot = immutable
- Payslip preview = still available (read-only computation)
- Deductions = still editable

---

### 3.3 Posted

**What posting does**
- Locks **financial state of the run**

**Locks**
- Manual deductions
- Payslip outputs

**After posting**
- No further financial changes allowed
- Payslips become final reference outputs

---

### 3.4 Paid

**What paid represents**
- Operational marker only (payment completed)

**Does NOT**
- Change computation
- Change snapshot
- Unlock anything

---

## 4. Payslip Computation Model

Payslips are:

- Computed from:
  - snapshot rows
  - schedule-bounded minutes
  - overtime policies
  - manual deductions

- NOT stored as final money values in draft/finalized stages

Key rule:

> Payslip values are **derived, not stored**, until posting.

---

## 5. Locking Semantics (Critical)

| Stage      | Snapshot | Deductions | Payslip Output |
|------------|----------|------------|----------------|
| Draft      | Editable | Editable   | Computed       |
| Finalized  | Locked   | Editable   | Computed       |
| Posted     | Locked   | Locked     | Final          |
| Paid       | Locked   | Locked     | Final          |

---

## 6. Deferred Scope (Explicit)

The following are intentionally NOT part of current payroll behavior:

- Government deductions (SSS, PhilHealth, etc.)
- Payment/payout integrations
- Accounting sync

UI and docs must always reflect this.

---

## 7. Operator Mental Model

When using payroll:

- “Finalize” = freeze inputs  
- “Preview” = computed output  
- “Post” = lock financial result  
- “Paid” = operational completion  

---

## 8. Common Misinterpretations (Now Prevented)

❌ “Finalize computes payroll”  
→ Incorrect

❌ “Finalize locks everything”  
→ Incorrect

❌ “Payslips don’t exist yet”  
→ Incorrect

❌ “Deductions are locked at finalize”  
→ Incorrect

---

## 9. Alignment Rules (Non-Optional)

All UI, docs, and future work MUST:

- Distinguish **snapshot vs computation**
- Distinguish **finalize vs post locking**
- Explicitly call out **deferred scope**
- Avoid implying hidden computation steps

---

## 10. Relationship to Other Docs

- `hr-3-1-finalize-payroll-runs.md` → finalize contract
- `hr-3-2-*` → payslip computation details
- `hr-status.md` → current implementation snapshot

This document sits **above them as behavioral truth**.

Operator UX note (hardening alignment, 2026-03-28 UTC):
- `/hr/payroll-runs`, payroll run detail, `/hr/payslips`, and `PayslipPreviewPanel` now use aligned helper/empty-state wording for:
  - snapshot vs computed preview,
  - finalize lock vs post lock,
  - deferred government deductions/payout integrations.

---

## 11. Future Extensions (Guardrails)

When adding features:

- Government deductions → extend computation layer, not snapshot
- Integrations → attach after posting stage
- Adjustments → must respect snapshot immutability

---

## Final Statement

> Payroll in Agui is a **snapshot-first, computation-on-demand, lock-by-stage system**.  
> Misunderstanding this leads directly to incorrect features.
