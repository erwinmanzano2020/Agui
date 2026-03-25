# HR Role / Feature Mapping (Current-State Canonical)

## Purpose

This document records the HR role model and feature relationship **as currently implemented**.

It is intentionally conservative and does not claim maturity that is not implemented.

## Current truth

- Feature access is currently the primary enforcement mechanism at many route entry points (especially APIs using `requireAnyFeatureAccessApi`).
- HR business access is then enforced using `requireHrAccess` / `requireHrAccessWithBranch` in domain-aware paths.
- Roles are business-level authority concepts, but there is not yet a fully separate role-only enforcement system everywhere.
- Do not assume explicit role checks exist unless the route/service actually implements them.

## Current known business roles

### House authority roles
- `owner`
- `manager`

These are normalized from multiple legacy role labels and treated as broad house-level authority.

### Non-authority/business-descriptive role
- `staff` (plus legacy aliases that normalize to staff)

`staff` does not by itself grant broad HR authority. HR access for non-authority actors depends on policy capability.

### Platform elevated role
- `game_master` (platform operational elevated authority lane)

This exists in the broader auth model; it is not a replacement for house business role semantics.

## Current platform/app access concepts

- `AppFeature` gates route/module entry (for example `PAYROLL`, `TEAM`, `DTR_BULK`).
- HR access helper (`requireHrAccess`) evaluates house roles and HR policy keys.
- Branch-limited behavior (`requireHrAccessWithBranch`) narrows usable access when branch-scoped policy keys are present.

## Role-to-feature relationship (today)

- Roles and features are related but not equivalent.
- In practice, many routes require feature access first, then run HR business access checks.
- A passing feature gate does not prove tenant scope or domain-valid mutation rights.
- A role can provide broad authority at house scope, while features remain entry gates.

## What is implemented vs conceptual/future

### Implemented now
- House authority role normalization (`owner` / `manager` as broad HR authority class).
- Policy-based HR access for non-authority actors via HR policy keys.
- Branch-limited narrowing based on branch-scoped policy keys.
- Feature-gated entry for many HR/payroll APIs.

### Conceptual / future (not implemented as a complete system)
- Fully separated role-first enforcement model across all HR routes.
- Branch-scoped role assignment model.
- Complete feature/permission semantic separation everywhere.

## Authoritative truth in code today

- Feature requirements are authoritative in `AppFeature` + feature guard helpers.
- HR business access decision logic is authoritative in `resolveHrAccess` / `requireHrAccessWithBranch`.
- Route/domain services remain authoritative for operation-specific mutation validity.

## Role mapping matrix (honest current state)

| Role | Intended access | Current enforcement state |
|---|---|---|
| owner | Broad HR authority for house-owned HR operations | Implemented in HR access evaluation (`allowedByRole`) and used by HR services/routes after entry guards |
| manager | Broad HR authority for house-owned HR operations | Implemented in HR access evaluation (`allowedByRole`) and used by HR services/routes after entry guards |
| staff | Limited, policy-granted HR capability only | Implemented as non-authority role; access depends on policy keys and branch narrowing where applied |
| game_master (platform) | Operational elevated authority in broader platform model | Exists in access resolver/platform role model; not a blanket substitute for HR house-role/domain checks |

## Guardrail statement

When reviewing or implementing HR routes:
- do not infer role enforcement from feature guard presence
- do not infer branch permissions from house membership alone
- do not infer mutation validity from auth/feature success alone
