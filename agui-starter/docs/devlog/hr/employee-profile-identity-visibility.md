# HR employee profile identity visibility (HR-1 completion)
- Date: 2025-03-15
- Module: HR
- Related PR(s): HR-1 employee profile identity visibility
- Devlog entry author: Codex

## Summary
- Made the employee profile the single read-only view for identity linkage: linked entity display name plus masked phone/email identifiers, with clear linked/unlinked badges.
- Rounded out the employment section with status, branch, rate per day, hire date, and the non-editable employee code label for house-scoped clarity.
- Added linked/unlinked identity badges with tooltips in the HR employee list to surface linkage state at a glance.

## Outcome
- HR users can immediately confirm identity linkage and employment basics without hunting through other flows.
- Reduces confusion around lookup-first behavior and prepares the surface for HR-2 follow-ups without new workflows.
