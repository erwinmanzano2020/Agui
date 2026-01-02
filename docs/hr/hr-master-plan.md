# HR Master Plan

This document anchors the HR milestones and keeps frozen contracts visible so downstream work stays consistent.

## HR-1 Status

- **Status:** Frozen
- **Scope:** Identity lookup/create, employee deduplication, and canonical RPC contracts.
- **Allowed changes while frozen:** Critical bug fixes that do not alter the frozen contracts, observability improvements, and documentation clarifications. Any schema or signature changes must be scheduled for post-freeze milestones (e.g., HR-2).

## Frozen Contracts

- **Canonical identity columns:** `identifier_type`, `identifier_value`. Legacy `kind` or `value_norm` fields are unsupported and must not be reintroduced.
- **Canonical HR RPC signatures:**
  - `hr_lookup_entities_by_identifiers(p_house_id uuid, p_identifiers jsonb)`
  - `hr_find_or_create_entity_for_employee(p_house_id uuid, p_display_name text, p_email text, p_phone text)`
  - `hr_get_entity_identity_summary(p_house_id uuid, p_entity_ids uuid[])`
- **Lookup-first Add Employee flow:** “No match” is a valid result. Zero matches should proceed to new identity creation; one or more matches require explicit selection to avoid duplicates.
- **Duplicate guardrail:** Partial unique index enforcement—only one active employee per `(house_id, entity_id)`.
- **Tenancy and access:** All HR and identity actions are house-scoped. No cross-house identity leakage; RPCs must run with RLS/grants appropriate for authenticated contexts.

## HR-2 (Next)

Plan upcoming changes here but keep HR-1 contracts untouched. Proposed expansions should note compatibility with the frozen interfaces above.
