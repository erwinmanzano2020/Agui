# HR employee identity alignment
- Date: 2025-03-08
- Module: HR
- Related PR(s): Document employee code autogen + identity contract
- Devlog entry author: Codex

## Summary
- Captured the canonical employee fields: `full_name` for names and DB-generated `code` per house (labels, not login identifiers).
- Documented the identity pattern: `entities` + `entity_identifiers` for people, with PHONE/EMAIL/auth_uid today and QR/card tokens as future non-guessable identifiers.
- Clarified that employee codes are house-scoped labels; branch assignments must match `house_id`.

## Outcome
- Future HR and identity work can align on the same schema/identifier rules without reintroducing display_name/code regressions.
- Prevents misuse of employee codes as authentication identifiers.

## Follow-ups
- Extend identity contract coverage to loyalty/senior/customer modules.
- Add monitoring around employee code counter drift and identifier collisions.
