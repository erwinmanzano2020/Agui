# POS Guardrails and Anti-Patterns (Canonical)

## 1. Purpose
This document defines strict POS guardrails and explicit anti-patterns to prevent architectural and security drift during implementation.

## 2. Non-Negotiable Guardrails
1. No cross-house leakage in any POS flow.
2. House remains the tenant boundary for all POS data access.
3. Branch is only an in-house limiter.
4. Deny-by-default and no-leak behavior are mandatory.
5. POS must enforce device/session discipline for operational actions.
6. Operator auth must require QR identifier + POS PIN direction (no QR-only auth).
7. POS must not redefine identity ownership.
8. POS PIN stays in POS operational credential domain, not HR core identity record.
9. POS submodules must inherit system/module rules without redefining them.
10. POS implementation tasks must remain phase-aligned and bounded by approved Phase 1 scope.

## 3. Explicit Anti-Patterns (Forbidden)
- QR-only operator authentication.
- module-local identity creation or identity merge logic outside shared identity rules.
- treating branch as a second tenant model.
- bypassing access resolution and querying by bare IDs.
- returning metadata that exceeds row scope.
- ad hoc shared-table creation without module-level ownership alignment.
- hidden contract creation in implementation tickets without canonical doc alignment.
- bypassing device/session requirement for order/payment operations.
- premature inventory coupling unless explicitly approved in scope.
- payment-settlement overreach beyond approved POS capture scope.

## 4. Guardrail Checkpoints for Implementation Planning
Each POS implementation task set should explicitly confirm:
- tenancy scope enforcement intent
- branch limiter handling
- identity reuse (not ownership)
- operator auth flow alignment
- device/session enforcement
- storage ownership boundary compliance
- out-of-scope protections retained

## 5. Last Updated
2026-04-01 (UTC)
