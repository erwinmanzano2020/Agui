# HR-2.3.3 Payroll Preview (Read-Only, House-Scoped)

## Purpose
Provide a **read-only payroll preview** that aggregates work minutes and derived overtime for a house and pay period. This is a bridge between HR-2 attendance data and HR-3 payroll runs.

## Inputs
- houseId (required)
- startDate / endDate (required, YYYY-MM-DD)
- branchId (optional)
- employeeId (optional)

## Outputs
- period { startDate, endDate }
- rows: per-employee totals
  - work minutes total
  - derived overtime minutes (raw + rounded)
  - flags: missing schedule days, open segment days, corrected segments
- summary: totals and flag counts across employees

## Guardrails (Non-Negotiable)
- **No payroll ledger tables**
- **No money computations** (no rates, no gross/net)
- **No mutation of DTR segments**
- **No schedule validation enforcement**
- **No auto-close or correction workflows**

## Deterministic Time Handling
- Overtime calculations reuse the HR-2.3 overtime engine.
- Schedule times are treated as **Asia/Manila** local time-of-day using deterministic conversions.

## Known Next Step
HR-3 payroll runs snapshot this preview output into run items. The preview logic and output remain frozen and read-only until explicitly revised.
