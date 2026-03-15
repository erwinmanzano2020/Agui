# HR employee code autogen + schema alignment
- Date: 2025-03-06
- Module: HR
- Related PR(s): Fix employee creation to rely on DB-generated codes
- Devlog entry author: Codex

## Summary
- Added DB-side code generation using `employee_code_counters`, a `next_employee_code` helper, and a `BEFORE INSERT` trigger so HR creates no longer send null codes.
- Fully aligned employee create/read paths to `full_name` (no `display_name`), matching the live employees schema.
- Grants ensure authenticated clients can hit the counter table/functions while RLS on `employees` remains enforced.

## Outcome
- HR “Add employee” no longer trips schema cache errors or `code` NOT NULL violations.
- Codes are sequential per house (`EI-###`) and concurrency-safe.

## Follow-ups
- Consider adding monitoring for counter gaps and exposing codes in audit logs.
- Extend the autogen pattern to other identity-like sequences that should be house-scoped.
