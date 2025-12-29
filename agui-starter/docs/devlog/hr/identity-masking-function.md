# HR identity masking function
- Date: 2025-03-15
- Module: HR
- Related PR(s): HR identity masking guardrails
- Devlog entry author: Codex

## Summary
- Added migration-backed `public.mask_identifier_value` functions (text + enum overload) so HR identity UIs always have masking available for EMAIL/PHONE identifiers.
- Recreated `hr_get_entity_identity_summary` to depend on the masking helper, order identifiers with primaries first, and stay limited to EMAIL/PHONE.
- Improved HR UI fallbacks when identity summaries fail so linked/unlinked status still shows while indicating identity is temporarily unavailable.

## Outcome
- Prevents production regressions caused by missing masking functions or schema cache drift.
- Ensures HR identity summaries remain stable and masked without manual SQL fixes.
